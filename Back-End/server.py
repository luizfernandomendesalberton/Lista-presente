import json
import hmac
import os
import re
import smtplib
import threading
import tempfile
import unicodedata
import uuid
from datetime import UTC
from decimal import Decimal, InvalidOperation
from datetime import datetime
from email.mime.text import MIMEText
from filelock import FileLock
from pathlib import Path

from flask import Flask, Response, jsonify, redirect, request, send_from_directory, session


BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
ENV_FILE = BACKEND_DIR / ".env"


def load_dotenv_file():
	if not ENV_FILE.exists():
		return

	with ENV_FILE.open("r", encoding="utf-8") as file:
		for raw_line in file:
			line = raw_line.strip()
			if not line or line.startswith("#") or "=" not in line:
				continue

			key, value = line.split("=", 1)
			key = key.strip()
			value = value.strip().strip('"').strip("'")

			# Do not overwrite values already provided by the system environment.
			if key and key not in os.environ:
				os.environ[key] = value


load_dotenv_file()

HTML_DIR = ROOT_DIR / "HTML"
CSS_DIR = ROOT_DIR / "CSS"
JS_DIR = ROOT_DIR / "JS"
RUNTIME_DATA_DIR = Path(os.getenv("RUNTIME_DATA_DIR", str(BACKEND_DIR / "runtime-data")))
PRESENTES_SEED_FILE = BACKEND_DIR / "presentes.json"
DATA_FILE = Path(os.getenv("DATA_FILE_PATH", str(RUNTIME_DATA_DIR / "presentes.json")))
CONVIDADOS_SEED_FILE = BACKEND_DIR / "convidados.json"
CONVIDADOS_FILE = Path(os.getenv("CONVIDADOS_FILE_PATH", str(RUNTIME_DATA_DIR / "convidados.json")))
PIX_CONTRIB_FILE = Path(os.getenv("PIX_CONTRIB_FILE_PATH", str(RUNTIME_DATA_DIR / "pix_contribuicoes.json")))
UNRESERVE_LOG_FILE = Path(os.getenv("UNRESERVE_LOG_FILE_PATH", str(RUNTIME_DATA_DIR / "desmarcacoes_reserva.json")))
ADMIN_SYNC_FILE = Path(os.getenv("ADMIN_SYNC_FILE_PATH", str(RUNTIME_DATA_DIR / "admin_sync_state.json")))
DEFAULT_IMAGE_URL = "https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=900&q=80"

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

app = Flask(__name__)
PRESENTES_LOCK = threading.Lock()
DATA_LOCK_FILE = Path(os.getenv("DATA_FILE_LOCK_PATH", str(DATA_FILE) + ".lock"))
PRESENTES_FILE_LOCK = FileLock(str(DATA_LOCK_FILE), timeout=15)
CONVIDADOS_LOCK = threading.Lock()
CONVIDADOS_LOCK_FILE = Path(os.getenv("CONVIDADOS_LOCK_PATH", str(CONVIDADOS_FILE) + ".lock"))
CONVIDADOS_FILE_LOCK = FileLock(str(CONVIDADOS_LOCK_FILE), timeout=15)
PIX_CONTRIB_LOCK = threading.Lock()
PIX_CONTRIB_LOCK_FILE = Path(os.getenv("PIX_CONTRIB_LOCK_PATH", str(PIX_CONTRIB_FILE) + ".lock"))
PIX_CONTRIB_FILE_LOCK = FileLock(str(PIX_CONTRIB_LOCK_FILE), timeout=15)
UNRESERVE_LOG_LOCK = threading.Lock()
UNRESERVE_LOG_LOCK_FILE = Path(os.getenv("UNRESERVE_LOG_LOCK_PATH", str(UNRESERVE_LOG_FILE) + ".lock"))
UNRESERVE_LOG_FILE_LOCK = FileLock(str(UNRESERVE_LOG_LOCK_FILE), timeout=15)
ADMIN_SYNC_LOCK = threading.Lock()
ADMIN_SYNC_LOCK_FILE = Path(os.getenv("ADMIN_SYNC_LOCK_PATH", str(ADMIN_SYNC_FILE) + ".lock"))
ADMIN_SYNC_FILE_LOCK = FileLock(str(ADMIN_SYNC_LOCK_FILE), timeout=15)
ACTIVE_ADMIN_SESSIONS = {}
ACTIVE_ADMIN_SESSIONS_LOCK = threading.Lock()
ADMIN_ACTIVITY_TTL_SECONDS = int(os.getenv("ADMIN_ACTIVITY_TTL_SECONDS", "900"))
APP_VERSION = str(os.getenv("APP_VERSION", "1.0.0")).strip() or "1.0.0"
DEFAULT_GUEST_PASSWORD = str(os.getenv("GUEST_PASSWORD", "luizeana") or "luizeana").strip() or "luizeana"

app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-me")


def clean_credential(value):
	# Normalizes accidental spaces/newlines copied from dashboards.
	return str(value or "").replace("\u200b", "").strip()


def normalize_name_key(value):
	clean = str(value or "").strip().lower()
	if not clean:
		return ""

	clean = unicodedata.normalize("NFKD", clean)
	clean = "".join(ch for ch in clean if not unicodedata.combining(ch))
	clean = re.sub(r"\s+", " ", clean)
	return clean


def default_convidados():
	return [
		{
			"id": 1,
			"nome": "Ana Paula Noiva",
			"grupo": "Noivos",
			"tipo": "noivos",
			"presenca_confirmada": False,
		},
		{
			"id": 2,
			"nome": "Noivo Luiz Fernando",
			"grupo": "Noivos",
			"tipo": "noivos",
			"presenca_confirmada": False,
		},
	]


def normalize_convidado(raw, forced_id=None):
	convidado_id = forced_id if forced_id is not None else raw.get("id")
	nome = str(raw.get("nome") or "").strip()
	if not nome:
		nome = f"Convidado {convidado_id or ''}".strip()

	tipo = str(raw.get("tipo") or "convidado").strip().lower()
	if tipo not in {"convidado", "noivos"}:
		tipo = "convidado"

	return {
		"id": int(convidado_id),
		"nome": nome,
		"nome_key": normalize_name_key(nome),
		"grupo": str(raw.get("grupo") or "Sem grupo").strip() or "Sem grupo",
		"tipo": tipo,
		"criado_em": str(raw.get("criado_em") or "").strip(),
		"presenca_confirmada": bool(raw.get("presenca_confirmada", False)),
		"vai_ao_evento": bool(raw.get("vai_ao_evento", False)),
		"presenca_confirmada_em": str(raw.get("presenca_confirmada_em") or "").strip(),
	}


def normalize_all_convidados(convidados):
	normalized = []
	for index, convidado in enumerate(convidados, start=1):
		normalized.append(normalize_convidado(convidado, forced_id=index))
	return normalized


def save_convidados(convidados):
	def _atomic_dump(target_file):
		target_file.parent.mkdir(parents=True, exist_ok=True)
		with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=target_file.parent, delete=False) as tmp_file:
			json.dump(convidados, tmp_file, ensure_ascii=False, indent=2)
			tmp_path = Path(tmp_file.name)

		os.replace(tmp_path, target_file)

	_atomic_dump(CONVIDADOS_FILE)


def load_convidados():
	data_file = CONVIDADOS_FILE
	if not data_file.exists():
		base = default_convidados()
		if CONVIDADOS_SEED_FILE.exists():
			with CONVIDADOS_SEED_FILE.open("r", encoding="utf-8") as file:
				loaded = json.load(file)
			if isinstance(loaded, list):
				base = loaded

		normalized = normalize_all_convidados(base)
		save_convidados(normalized)
		return normalized

	with data_file.open("r", encoding="utf-8") as file:
		loaded = json.load(file)

	if not isinstance(loaded, list):
		loaded = default_convidados()

	normalized = normalize_all_convidados(loaded)
	if normalized != loaded:
		save_convidados(normalized)

	return normalized


def is_guest_authenticated():
	return bool(session.get("guest_authenticated"))


def get_current_guest_name_key():
	return normalize_name_key(session.get("guest_name_key") or "")


def get_guest_password():
	return clean_credential(os.getenv("GUEST_PASSWORD", DEFAULT_GUEST_PASSWORD)) or "luizeana"


def get_guest_from_session(convidados=None):
	name_key = get_current_guest_name_key()
	if not name_key:
		return None

	all_convidados = convidados if convidados is not None else load_convidados()
	return next((item for item in all_convidados if item.get("nome_key") == name_key), None)


def can_access_presentes():
	if is_session_admin():
		return True

	if not is_guest_authenticated():
		return False

	convidado = get_guest_from_session()
	if not convidado:
		return False

	if convidado.get("tipo") == "noivos":
		return True

	return bool(convidado.get("presenca_confirmada"))


def build_convidado_payload(convidado):
	status = "pendente"
	if bool(convidado.get("presenca_confirmada")):
		status = "confirmado" if bool(convidado.get("vai_ao_evento")) else "nao_vai"

	return {
		"id": int(convidado.get("id") or 0),
		"nome": str(convidado.get("nome") or "").strip(),
		"grupo": str(convidado.get("grupo") or "Sem grupo").strip() or "Sem grupo",
		"tipo": str(convidado.get("tipo") or "convidado").strip(),
		"status_presenca": status,
		"presenca_confirmada": bool(convidado.get("presenca_confirmada")),
		"vai_ao_evento": bool(convidado.get("vai_ao_evento")),
		"presenca_confirmada_em": str(convidado.get("presenca_confirmada_em") or "").strip(),
	}


def default_presentes():
	return [
		{
			"id": 1,
			"nome": "Jogo de Jantar 30 Peças",
			"descricao": "Conjunto em porcelana para uso diário e ocasiões especiais.",
			"categoria": "Cozinha",
			"preco": 399.9,
			"foto_url": "https://images.unsplash.com/photo-1516594915697-87eb3b1c14ea?auto=format&fit=crop&w=900&q=80",
			"especificacoes": ["30 peças", "Porcelana branca", "Pode ir ao micro-ondas"],
			"reservado": False,
		},
		{
			"id": 2,
			"nome": "Air Fryer 5L",
			"descricao": "Perfeita para preparar refeições rápidas e saudáveis.",
			"categoria": "Eletroportáteis",
			"preco": 499.0,
			"foto_url": "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=900&q=80",
			"especificacoes": ["Capacidade de 5 litros", "Controle de temperatura", "Timer automático"],
			"reservado": False,
		},
		{
			"id": 3,
			"nome": "Conjunto de Toalhas Premium",
			"descricao": "Kit com banho e rosto em algodão egípcio.",
			"categoria": "Cama, Mesa e Banho",
			"preco": 189.5,
			"foto_url": "https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?auto=format&fit=crop&w=900&q=80",
			"especificacoes": ["100% algodão", "Toque macio", "Alta absorção"],
			"reservado": False,
		},
	]


def normalize_preco(raw_preco):
	if isinstance(raw_preco, (int, float)):
		return float(raw_preco)

	if isinstance(raw_preco, str):
		text = raw_preco.strip().replace("R$", "").replace(" ", "").replace(",", ".")
		if not text:
			return 0.0
		try:
			return float(Decimal(text))
		except (InvalidOperation, ValueError):
			return None

	return None


def normalize_especificacoes(raw):
	if not raw:
		return []

	if isinstance(raw, list):
		clean = [str(item).strip() for item in raw if str(item).strip()]
		return clean[:12]

	if isinstance(raw, str):
		lines = [line.strip() for line in raw.splitlines() if line.strip()]
		return lines[:12]

	return []


def normalize_presente(raw, forced_id=None):
	presente_id = forced_id if forced_id is not None else raw.get("id")
	preco = normalize_preco(raw.get("preco"))
	if preco is None:
		preco = 0.0

	normalized = {
		"id": int(presente_id),
		"nome": str(raw.get("nome") or "Presente sem nome").strip(),
		"descricao": str(raw.get("descricao") or "").strip(),
		"categoria": str(raw.get("categoria") or "Geral").strip(),
		"preco": round(preco, 2),
		"foto_url": str(raw.get("foto_url") or DEFAULT_IMAGE_URL).strip() or DEFAULT_IMAGE_URL,
		"produto_url": str(raw.get("produto_url") or "").strip(),
		"especificacoes": normalize_especificacoes(raw.get("especificacoes")),
		"reservado": bool(raw.get("reservado", False)),
	}

	if raw.get("reservado_por_nome"):
		normalized["reservado_por_nome"] = str(raw.get("reservado_por_nome")).strip()
	if raw.get("reservado_por_email"):
		normalized["reservado_por_email"] = str(raw.get("reservado_por_email")).strip().lower()
	if raw.get("reservado_em"):
		normalized["reservado_em"] = str(raw.get("reservado_em")).strip()
	if raw.get("criado_em"):
		normalized["criado_em"] = str(raw.get("criado_em")).strip()

	return normalized


def normalize_all_presentes(presentes):
	normalized = []
	for index, presente in enumerate(presentes, start=1):
		normalized.append(normalize_presente(presente, forced_id=index))
	return normalized


def next_presente_id(presentes):
	if not presentes:
		return 1
	return max(int(item.get("id", 0)) for item in presentes) + 1


def parse_email_list(raw_value):
	if not raw_value:
		return []

	parts = re.split(r"[,;\s]+", str(raw_value))
	emails = []
	for part in parts:
		email = part.strip().lower()
		if email and EMAIL_REGEX.match(email):
			emails.append(email)

	return list(dict.fromkeys(emails))


def normalize_pix_text(value, max_len):
	clean = re.sub(r"[^A-Za-z0-9 ]+", "", str(value or "").strip().upper())
	clean = re.sub(r"\s+", " ", clean).strip()
	if not clean:
		return "NAO INFORMADO"
	return clean[:max_len]


def emv_field(field_id, value):
	text = str(value)
	return f"{field_id}{len(text):02d}{text}"


def crc16_ccitt(payload):
	crc = 0xFFFF
	for char in payload:
		crc ^= ord(char) << 8
		for _ in range(8):
			if crc & 0x8000:
				crc = (crc << 1) ^ 0x1021
			else:
				crc <<= 1
			crc &= 0xFFFF

	return f"{crc:04X}"


def build_pix_payload(pix_key, amount, txid):
	gui = emv_field("00", "BR.GOV.BCB.PIX")
	key_field = emv_field("01", pix_key)
	merchant_account = emv_field("26", f"{gui}{key_field}")

	receiver_name = normalize_pix_text(os.getenv("PIX_RECEIVER_NAME", "CASAMENTO"), 25)
	receiver_city = normalize_pix_text(os.getenv("PIX_RECEIVER_CITY", "SAO PAULO"), 15)

	parts = [
		emv_field("00", "01"),
		merchant_account,
		emv_field("52", "0000"),
		emv_field("53", "986"),
	]

	if amount and amount > 0:
		parts.append(emv_field("54", f"{amount:.2f}"))

	parts.extend(
		[
			emv_field("58", "BR"),
			emv_field("59", receiver_name),
			emv_field("60", receiver_city),
			emv_field("62", emv_field("05", txid)),
		]
	)

	base_payload = "".join(parts)
	payload_for_crc = f"{base_payload}6304"
	crc = crc16_ccitt(payload_for_crc)
	return f"{payload_for_crc}{crc}"


def get_admin_users():
	users = {}
	for index in (1, 2):
		email = clean_credential(os.getenv(f"ADMIN_USER_{index}_EMAIL", "")).lower()
		password = clean_credential(os.getenv(f"ADMIN_USER_{index}_PASSWORD", ""))
		if email and password:
			users[email] = password

	return users


def is_session_admin():
	email = str(session.get("admin_email") or "").strip().lower()
	if not email:
		return False

	return email in get_admin_users()


def has_valid_admin_token(request_obj):
	configured_token = os.getenv("ADMIN_TOKEN", "").strip()
	if not configured_token:
		return False

	sent_token = request_obj.headers.get("X-Admin-Token", "").strip()
	if sent_token and hmac.compare_digest(sent_token, configured_token):
		return True

	return False


def require_admin_auth(request_obj):
	if has_valid_admin_token(request_obj):
		return None

	if is_session_admin():
		touch_admin_session(str(session.get("admin_email") or ""), str(session.get("admin_session_id") or ""))
		return None

	return jsonify({"erro": "Acesso restrito. Faça login como administrador."}), 401


def get_json_export_owner_email():
	configured = clean_credential(os.getenv("JSON_EXPORT_OWNER_EMAIL", "")).lower()
	if configured:
		return configured

	# Fallback: first admin user is considered the export owner when no dedicated variable is set.
	return clean_credential(os.getenv("ADMIN_USER_1_EMAIL", "")).lower()


def require_json_export_owner():
	owner_email = get_json_export_owner_email()
	if not owner_email:
		return jsonify({"erro": "Exportação JSON não configurada. Defina JSON_EXPORT_OWNER_EMAIL no servidor."}), 503

	if not is_session_admin():
		return jsonify({"erro": "Faça login com o e-mail autorizado para exportar o JSON."}), 401

	current_email = clean_credential(session.get("admin_email") or "").lower()
	if current_email != owner_email:
		return jsonify({"erro": "Somente o e-mail autorizado pode baixar o JSON."}), 403

	return None


def utc_now():
	return datetime.now(UTC)


def cleanup_admin_sessions_locked(now_utc):
	deadline = now_utc.timestamp() - max(ADMIN_ACTIVITY_TTL_SECONDS, 30)
	stale_ids = [
		session_id
		for session_id, data in ACTIVE_ADMIN_SESSIONS.items()
		if float(data.get("last_seen_ts", 0)) < deadline
	]

	for session_id in stale_ids:
		ACTIVE_ADMIN_SESSIONS.pop(session_id, None)


def touch_admin_session(email, session_id):
	clean_email = str(email or "").strip().lower()
	clean_session_id = str(session_id or "").strip()
	if not clean_email or not clean_session_id:
		return

	now_utc = utc_now()
	with ACTIVE_ADMIN_SESSIONS_LOCK:
		cleanup_admin_sessions_locked(now_utc)
		ACTIVE_ADMIN_SESSIONS[clean_session_id] = {
			"email": clean_email,
			"last_seen": now_utc.isoformat(),
			"last_seen_ts": now_utc.timestamp(),
		}


def remove_admin_session(session_id):
	clean_session_id = str(session_id or "").strip()
	if not clean_session_id:
		return

	with ACTIVE_ADMIN_SESSIONS_LOCK:
		ACTIVE_ADMIN_SESSIONS.pop(clean_session_id, None)


def get_active_admin_sessions_payload():
	now_utc = utc_now()
	with ACTIVE_ADMIN_SESSIONS_LOCK:
		cleanup_admin_sessions_locked(now_utc)
		sessions_by_email = {}
		for data in ACTIVE_ADMIN_SESSIONS.values():
			email = str(data.get("email") or "").strip().lower()
			if not email:
				continue

			candidate = {
				"email": email,
				"last_seen": str(data.get("last_seen") or "").strip(),
			}
			current = sessions_by_email.get(email)
			if not current or candidate["last_seen"] > current.get("last_seen", ""):
				sessions_by_email[email] = candidate

		sessions_payload = list(sessions_by_email.values())

	sessions_payload.sort(key=lambda item: item.get("last_seen", ""), reverse=True)
	return {
		"total": len(sessions_payload),
		"ttl_segundos": max(ADMIN_ACTIVITY_TTL_SECONDS, 30),
		"sessions": sessions_payload,
	}


def normalize_pix_contribution(raw, forced_id=None):
	contrib_id = forced_id if forced_id is not None else raw.get("id")
	valor = normalize_preco(raw.get("valor"))
	if valor is None:
		valor = 0.0

	return {
		"id": int(contrib_id),
		"nome": str(raw.get("nome") or "Não informado").strip(),
		"valor": round(float(valor), 2),
		"referencia": str(raw.get("referencia") or "Contribuicao em dinheiro").strip() or "Contribuicao em dinheiro",
		"txid": str(raw.get("txid") or "").strip(),
		"criado_em": str(raw.get("criado_em") or "").strip(),
		"email_status": str(raw.get("email_status") or "").strip(),
	}


def normalize_all_pix_contributions(contributions):
	normalized = []
	for index, contribution in enumerate(contributions, start=1):
		normalized.append(normalize_pix_contribution(contribution, forced_id=index))
	return normalized


def save_pix_contributions(contributions):
	def _atomic_dump(target_file):
		target_file.parent.mkdir(parents=True, exist_ok=True)
		with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=target_file.parent, delete=False) as tmp_file:
			json.dump(contributions, tmp_file, ensure_ascii=False, indent=2)
			tmp_path = Path(tmp_file.name)

		os.replace(tmp_path, target_file)

	_atomic_dump(PIX_CONTRIB_FILE)


def load_pix_contributions():
	data_file = PIX_CONTRIB_FILE
	if not data_file.exists():
		return []

	with data_file.open("r", encoding="utf-8") as file:
		loaded = json.load(file)

	if not isinstance(loaded, list):
		return []

	normalized = normalize_all_pix_contributions(loaded)
	if normalized != loaded:
		save_pix_contributions(normalized)

	return normalized


def append_pix_contribution(contribution):
	with PIX_CONTRIB_LOCK:
		with PIX_CONTRIB_FILE_LOCK:
			all_contributions = load_pix_contributions()
			normalized = normalize_pix_contribution(contribution, forced_id=len(all_contributions) + 1)
			all_contributions.append(normalized)
			save_pix_contributions(all_contributions)

	return normalized


def normalize_unreserve_entry(raw, forced_id=None):
	entry_id = forced_id if forced_id is not None else raw.get("id")

	return {
		"id": int(entry_id),
		"presente_id": int(raw.get("presente_id") or 0),
		"presente_nome": str(raw.get("presente_nome") or "Presente").strip(),
		"reservado_por_nome": str(raw.get("reservado_por_nome") or "Não informado").strip(),
		"reservado_por_email": str(raw.get("reservado_por_email") or "").strip().lower(),
		"desmarcado_por": str(raw.get("desmarcado_por") or "admin").strip(),
		"desmarcado_em": str(raw.get("desmarcado_em") or "").strip(),
	}


def normalize_all_unreserve_entries(entries):
	normalized = []
	for index, entry in enumerate(entries, start=1):
		normalized.append(normalize_unreserve_entry(entry, forced_id=index))
	return normalized


def default_admin_sync_state():
	return {
		"novos_produtos_ack_em": get_latest_created_timestamp(load_presentes()),
		"novos_convidados_ack_em": get_latest_created_timestamp(load_convidados()),
		"ultimo_export_em": "",
		"ultimo_export_convidados_em": "",
	}


def normalize_admin_sync_state(raw):
	if not isinstance(raw, dict):
		return default_admin_sync_state()

	return {
		"novos_produtos_ack_em": str(raw.get("novos_produtos_ack_em") or "").strip(),
		"novos_convidados_ack_em": str(raw.get("novos_convidados_ack_em") or "").strip(),
		"ultimo_export_em": str(raw.get("ultimo_export_em") or "").strip(),
		"ultimo_export_convidados_em": str(raw.get("ultimo_export_convidados_em") or "").strip(),
	}


def save_admin_sync_state(state):
	def _atomic_dump(target_file):
		target_file.parent.mkdir(parents=True, exist_ok=True)
		with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=target_file.parent, delete=False) as tmp_file:
			json.dump(state, tmp_file, ensure_ascii=False, indent=2)
			tmp_path = Path(tmp_file.name)

		os.replace(tmp_path, target_file)

	_atomic_dump(ADMIN_SYNC_FILE)


def load_admin_sync_state():
	data_file = ADMIN_SYNC_FILE
	if not data_file.exists():
		state = default_admin_sync_state()
		save_admin_sync_state(state)
		return state

	with data_file.open("r", encoding="utf-8") as file:
		loaded = json.load(file)

	normalized = normalize_admin_sync_state(loaded)
	if not normalized.get("novos_produtos_ack_em"):
		normalized["novos_produtos_ack_em"] = get_latest_created_timestamp(load_presentes())
	if not normalized.get("novos_convidados_ack_em"):
		normalized["novos_convidados_ack_em"] = get_latest_created_timestamp(load_convidados())
	if normalized != loaded:
		save_admin_sync_state(normalized)

	return normalized


def parse_iso_utc(value):
	text = str(value or "").strip()
	if not text:
		return None

	try:
		parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
	except ValueError:
		return None

	if parsed.tzinfo is None:
		return parsed.replace(tzinfo=UTC)

	return parsed.astimezone(UTC)


def get_latest_created_timestamp(items):
	latest = None
	for item in items:
		created_dt = parse_iso_utc(item.get("criado_em"))
		if not created_dt:
			continue
		if latest is None or created_dt > latest:
			latest = created_dt

	return latest.isoformat() if latest else ""


def get_pending_new_products(presentes, ack_timestamp):
	ack_dt = parse_iso_utc(ack_timestamp)
	pending = []

	for item in presentes:
		created_dt = parse_iso_utc(item.get("criado_em"))
		if not created_dt:
			continue

		if ack_dt and created_dt <= ack_dt:
			continue

		pending.append(
			{
				"id": int(item.get("id") or 0),
				"nome": str(item.get("nome") or "Presente").strip(),
				"criado_em": created_dt.isoformat(),
			}
		)

	pending.sort(key=lambda item: item.get("criado_em", ""), reverse=True)
	return pending


def get_pending_new_guests(convidados, ack_timestamp):
	ack_dt = parse_iso_utc(ack_timestamp)
	pending = []

	for item in convidados:
		created_dt = parse_iso_utc(item.get("criado_em"))
		if not created_dt:
			continue

		if ack_dt and created_dt <= ack_dt:
			continue

		pending.append(
			{
				"id": int(item.get("id") or 0),
				"nome": str(item.get("nome") or "Convidado").strip(),
				"grupo": str(item.get("grupo") or "Sem grupo").strip() or "Sem grupo",
				"criado_em": created_dt.isoformat(),
			}
		)

	pending.sort(key=lambda item: item.get("criado_em", ""), reverse=True)
	return pending


def acknowledge_new_products():
	with ADMIN_SYNC_LOCK:
		with ADMIN_SYNC_FILE_LOCK:
			state = load_admin_sync_state()
			now_iso = utc_now().isoformat()
			state["novos_produtos_ack_em"] = now_iso
			state["ultimo_export_em"] = now_iso
			save_admin_sync_state(state)
			return state


def acknowledge_new_guests():
	with ADMIN_SYNC_LOCK:
		with ADMIN_SYNC_FILE_LOCK:
			state = load_admin_sync_state()
			now_iso = utc_now().isoformat()
			state["novos_convidados_ack_em"] = now_iso
			state["ultimo_export_convidados_em"] = now_iso
			save_admin_sync_state(state)
			return state


def save_unreserve_entries(entries):
	def _atomic_dump(target_file):
		target_file.parent.mkdir(parents=True, exist_ok=True)
		with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=target_file.parent, delete=False) as tmp_file:
			json.dump(entries, tmp_file, ensure_ascii=False, indent=2)
			tmp_path = Path(tmp_file.name)

		os.replace(tmp_path, target_file)

	_atomic_dump(UNRESERVE_LOG_FILE)


def load_unreserve_entries():
	data_file = UNRESERVE_LOG_FILE
	if not data_file.exists():
		return []

	with data_file.open("r", encoding="utf-8") as file:
		loaded = json.load(file)

	if not isinstance(loaded, list):
		return []

	normalized = normalize_all_unreserve_entries(loaded)
	if normalized != loaded:
		save_unreserve_entries(normalized)

	return normalized


def append_unreserve_entry(entry):
	with UNRESERVE_LOG_LOCK:
		with UNRESERVE_LOG_FILE_LOCK:
			all_entries = load_unreserve_entries()
			normalized = normalize_unreserve_entry(entry, forced_id=len(all_entries) + 1)
			all_entries.append(normalized)
			save_unreserve_entries(all_entries)

	return normalized


def load_presentes():
	data_file = DATA_FILE
	if not data_file.exists():
		base = default_presentes()
		if PRESENTES_SEED_FILE.exists():
			with PRESENTES_SEED_FILE.open("r", encoding="utf-8") as file:
				loaded = json.load(file)
			if isinstance(loaded, list):
				base = loaded

		normalized = normalize_all_presentes(base)
		save_presentes(normalized)
		return normalized

	with data_file.open("r", encoding="utf-8") as file:
		loaded = json.load(file)

	normalized = normalize_all_presentes(loaded)
	if normalized != loaded:
		save_presentes(normalized)

	return normalized


def save_presentes(presentes):
	def _atomic_dump(target_file):
		target_file.parent.mkdir(parents=True, exist_ok=True)
		with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=target_file.parent, delete=False) as tmp_file:
			json.dump(presentes, tmp_file, ensure_ascii=False, indent=2)
			tmp_path = Path(tmp_file.name)

		os.replace(tmp_path, target_file)

	_atomic_dump(DATA_FILE)


def send_notification_email(presente, nome_responsavel, email_responsavel):
	smtp_host = os.getenv("SMTP_HOST")
	smtp_port = int(os.getenv("SMTP_PORT", "587"))
	smtp_user = os.getenv("SMTP_USER")
	smtp_password = os.getenv("SMTP_PASSWORD")
	smtp_use_tls = os.getenv("SMTP_USE_TLS", "1") == "1"

	notify_to_emails = parse_email_list(os.getenv("NOTIFY_TO_EMAIL"))
	from_email = os.getenv("FROM_EMAIL", smtp_user or "")

	if not all([smtp_host, smtp_user, smtp_password, notify_to_emails]):
		raise ValueError(
			"Configuração SMTP incompleta. Defina SMTP_HOST, SMTP_USER, SMTP_PASSWORD e NOTIFY_TO_EMAIL com um ou mais emails válidos."
		)

	body = (
		"Novo presente reservado na lista de casamento.\n\n"
		f"Presente: {presente['nome']}\n"
		f"Preço: R$ {presente.get('preco', 0):.2f}\n"
		f"Nome de quem reservou: {nome_responsavel}\n"
		f"E-mail de quem reservou: {email_responsavel}\n"
		f"Data/Hora: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n"
	)

	message = MIMEText(body, "plain", "utf-8")
	message["Subject"] = f"Presente reservado: {presente['nome']}"
	message["From"] = from_email
	message["To"] = ", ".join(notify_to_emails)

	with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
		if smtp_use_tls:
			server.starttls()
		server.login(smtp_user, smtp_password)
		server.sendmail(from_email, notify_to_emails, message.as_string())


def send_pix_notification_email(nome_responsavel, valor, referencia):
	smtp_host = os.getenv("SMTP_HOST")
	smtp_port = int(os.getenv("SMTP_PORT", "587"))
	smtp_user = os.getenv("SMTP_USER")
	smtp_password = os.getenv("SMTP_PASSWORD")
	smtp_use_tls = os.getenv("SMTP_USE_TLS", "1") == "1"

	pix_notify_to = os.getenv("PIX_NOTIFY_TO_EMAIL") or os.getenv("NOTIFY_TO_EMAIL")
	notify_to_emails = parse_email_list(pix_notify_to)
	from_email = os.getenv("FROM_EMAIL", smtp_user or "")

	if not all([smtp_host, smtp_user, smtp_password, notify_to_emails]):
		raise ValueError(
			"Configuração SMTP incompleta para PIX. Defina SMTP_HOST, SMTP_USER, SMTP_PASSWORD e PIX_NOTIFY_TO_EMAIL (ou NOTIFY_TO_EMAIL)."
		)

	body = (
		"Nova intenção de contribuição via PIX na lista de casamento.\n\n"
		f"Nome: {nome_responsavel}\n"
		f"Valor informado: R$ {valor:.2f}\n"
		f"Referência: {referencia}\n"
		f"Data/Hora: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n"
	)

	message = MIMEText(body, "plain", "utf-8")
	message["Subject"] = f"PIX recebido de {nome_responsavel}"
	message["From"] = from_email
	message["To"] = ", ".join(notify_to_emails)

	with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
		if smtp_use_tls:
			server.starttls()
		server.login(smtp_user, smtp_password)
		server.sendmail(from_email, notify_to_emails, message.as_string())


def send_presence_notification_email(grupo, nome_convidado, vai_ao_evento, confirmados_no_grupo, total_no_grupo):
	smtp_host = os.getenv("SMTP_HOST")
	smtp_port = int(os.getenv("SMTP_PORT", "587"))
	smtp_user = os.getenv("SMTP_USER")
	smtp_password = os.getenv("SMTP_PASSWORD")
	smtp_use_tls = os.getenv("SMTP_USE_TLS", "1") == "1"

	presence_notify_to = os.getenv("PRESENCA_NOTIFY_TO_EMAIL") or os.getenv("NOTIFY_TO_EMAIL")
	notify_to_emails = parse_email_list(presence_notify_to)
	from_email = os.getenv("FROM_EMAIL", smtp_user or "")

	if not all([smtp_host, smtp_user, smtp_password, notify_to_emails]):
		raise ValueError(
			"Configuração SMTP incompleta para presença. Defina SMTP_HOST, SMTP_USER, SMTP_PASSWORD e PRESENCA_NOTIFY_TO_EMAIL (ou NOTIFY_TO_EMAIL)."
		)

	status_text = "confirmou presença" if vai_ao_evento else "informou que não irá"
	body = (
		"Atualização da lista de presença do casamento.\n\n"
		f"Grupo/Família: {grupo}\n"
		f"Convidado: {nome_convidado}\n"
		f"Resposta: {status_text}\n"
		f"Confirmações no grupo: {confirmados_no_grupo}/{total_no_grupo}\n"
		f"Data/Hora: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n"
	)

	message = MIMEText(body, "plain", "utf-8")
	message["Subject"] = f"Presença atualizada - {grupo}"
	message["From"] = from_email
	message["To"] = ", ".join(notify_to_emails)

	with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
		if smtp_use_tls:
			server.starttls()
		server.login(smtp_user, smtp_password)
		server.sendmail(from_email, notify_to_emails, message.as_string())


def send_presence_change_request_email(grupo, nome_convidado, vai_ao_evento, mensagem=None):
	smtp_host = os.getenv("SMTP_HOST")
	smtp_port = int(os.getenv("SMTP_PORT", "587"))
	smtp_user = os.getenv("SMTP_USER")
	smtp_password = os.getenv("SMTP_PASSWORD")
	smtp_use_tls = os.getenv("SMTP_USE_TLS", "1") == "1"

	presence_notify_to = os.getenv("PRESENCA_NOTIFY_TO_EMAIL") or os.getenv("NOTIFY_TO_EMAIL")
	notify_to_emails = parse_email_list(presence_notify_to)
	from_email = os.getenv("FROM_EMAIL", smtp_user or "")

	if not all([smtp_host, smtp_user, smtp_password, notify_to_emails]):
		raise ValueError(
			"Configuração SMTP incompleta para presença. Defina SMTP_HOST, SMTP_USER, SMTP_PASSWORD e PRESENCA_NOTIFY_TO_EMAIL (ou NOTIFY_TO_EMAIL)."
		)

	status_text = "confirmado" if vai_ao_evento else "não vai"
	change_reason = str(mensagem or "").strip() or "Desejo trocar a resposta da confirmação de presença."
	body = (
		"Solicitação de alteração da resposta de presença.\n\n"
		f"Grupo/Família: {grupo}\n"
		f"Convidado: {nome_convidado}\n"
		f"Status atual: {status_text}\n"
		f"Motivo informado: {change_reason}\n"
		f"Data/Hora: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n"
	)

	message = MIMEText(body, "plain", "utf-8")
	message["Subject"] = f"Solicitação de alteração de presença - {grupo}"
	message["From"] = from_email
	message["To"] = ", ".join(notify_to_emails)

	with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
		if smtp_use_tls:
			server.starttls()
		server.login(smtp_user, smtp_password)
		server.sendmail(from_email, notify_to_emails, message.as_string())


@app.after_request
def add_cors_headers(response):
	response.headers["Access-Control-Allow-Origin"] = "*"
	response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
	response.headers["Access-Control-Allow-Headers"] = "Content-Type,X-Admin-Token"
	return response


@app.route("/", methods=["GET"])
def index():
	# Always require guests to pass through the password screen again on home access.
	session.pop("guest_authenticated", None)
	session.pop("guest_name_key", None)
	session.pop("guest_nome", None)
	response = send_from_directory(HTML_DIR, "acesso.html")
	response.headers["Cache-Control"] = "no-store, max-age=0"
	return response


@app.route("/sair", methods=["GET"])
def sair_para_login():
	remove_admin_session(session.get("admin_session_id"))
	session.pop("admin_email", None)
	session.pop("admin_session_id", None)
	session.pop("guest_authenticated", None)
	session.pop("guest_name_key", None)
	session.pop("guest_nome", None)
	return redirect("/", code=302)


@app.route("/presenca", methods=["GET"])
def presenca_page():
	if not is_guest_authenticated() and not is_session_admin():
		return redirect("/", code=302)

	response = send_from_directory(HTML_DIR, "presenca.html")
	response.headers["Cache-Control"] = "no-store, max-age=0"
	return response


@app.route("/presentes", methods=["GET"])
def presentes_page():
	if not can_access_presentes():
		if is_guest_authenticated() or is_session_admin():
			return redirect("/presenca", code=302)
		return redirect("/", code=302)

	response = send_from_directory(HTML_DIR, "lista.html")
	response.headers["Cache-Control"] = "no-store, max-age=0"
	return response


@app.route("/admin", methods=["GET"])
def admin_page():
	response = send_from_directory(HTML_DIR, "admin.html")
	response.headers["Cache-Control"] = "no-store, max-age=0"
	return response


@app.route("/admin/metricas", methods=["GET"])
def admin_metrics_page():
	response = send_from_directory(HTML_DIR, "admin-metricas.html")
	response.headers["Cache-Control"] = "no-store, max-age=0"
	return response


@app.route("/admin/convidados", methods=["GET"])
def admin_convidados_page():
	response = send_from_directory(HTML_DIR, "admin-convidados.html")
	response.headers["Cache-Control"] = "no-store, max-age=0"
	return response


@app.route("/CSS/<path:filename>", methods=["GET"])
def css_files(filename):
	response = send_from_directory(CSS_DIR, filename)
	response.headers["Cache-Control"] = "no-store, max-age=0"
	return response


@app.route("/JS/<path:filename>", methods=["GET"])
def js_files(filename):
	response = send_from_directory(JS_DIR, filename)
	response.headers["Cache-Control"] = "no-store, max-age=0"
	return response


@app.route("/api/guest/login", methods=["POST", "OPTIONS"])
def guest_login():
	if request.method == "OPTIONS":
		return ("", 204)

	payload = request.get_json(silent=True) or {}
	password = clean_credential(payload.get("password") or "")
	configured_password = get_guest_password()

	if not password:
		return jsonify({"erro": "Informe a senha para continuar."}), 400

	if not hmac.compare_digest(password, configured_password):
		return jsonify({"erro": "Senha inválida."}), 401

	session["guest_authenticated"] = True
	session.pop("guest_name_key", None)
	session.pop("guest_nome", None)

	convidado = get_guest_from_session()
	return jsonify(
		{
			"mensagem": "Senha validada com sucesso.",
			"authenticated": True,
			"guest_nome": convidado.get("nome") if convidado else "",
			"can_access_presentes": can_access_presentes(),
		}
	)


@app.route("/api/guest/logout", methods=["POST", "OPTIONS"])
def guest_logout():
	if request.method == "OPTIONS":
		return ("", 204)

	session.pop("guest_authenticated", None)
	session.pop("guest_name_key", None)
	session.pop("guest_nome", None)
	return jsonify({"mensagem": "Sessão encerrada."})


@app.route("/api/guest/session", methods=["GET"])
def guest_session_status():
	convidados = load_convidados()
	convidado = get_guest_from_session(convidados)
	admin_email = str(session.get("admin_email") or "").strip().lower()

	return jsonify(
		{
			"authenticated": bool(is_guest_authenticated() or is_session_admin()),
			"guest_authenticated": is_guest_authenticated(),
			"admin_authenticated": is_session_admin(),
			"admin_email": admin_email,
			"guest_nome": convidado.get("nome") if convidado else "",
			"guest_tipo": convidado.get("tipo") if convidado else "",
			"presenca_confirmada": bool(convidado.get("presenca_confirmada")) if convidado else False,
			"can_access_presentes": can_access_presentes(),
		}
	)


@app.route("/api/presenca/grupos", methods=["GET"])
def listar_presenca_grupos():
	if not is_guest_authenticated() and not is_session_admin():
		return jsonify({"erro": "Faça login com a senha para acessar esta área."}), 401

	convidados = load_convidados()
	grupos = {}
	for convidado in convidados:
		grupo = convidado.get("grupo") or "Sem grupo"
		grupos.setdefault(grupo, []).append(
			{
				"id": convidado.get("id"),
				"nome": convidado.get("nome"),
				"tipo": convidado.get("tipo") or "convidado",
				"presenca_confirmada": bool(convidado.get("presenca_confirmada")),
				"vai_ao_evento": bool(convidado.get("vai_ao_evento")),
				"presenca_confirmada_em": convidado.get("presenca_confirmada_em") or "",
			}
		)

	grupos_payload = [
		{"grupo": nome_grupo, "convidados": convidados_do_grupo}
		for nome_grupo, convidados_do_grupo in grupos.items()
	]

	grupos_payload.sort(key=lambda item: (0 if item.get("grupo") == "Noivos" else 1, item.get("grupo", "")))

	convidado_sessao = get_guest_from_session(convidados)
	return jsonify(
		{
			"grupos": grupos_payload,
			"guest_nome": convidado_sessao.get("nome") if convidado_sessao else "",
			"guest_tipo": convidado_sessao.get("tipo") if convidado_sessao else "",
			"can_access_presentes": can_access_presentes(),
		}
	)


@app.route("/api/presenca/confirmar", methods=["POST", "OPTIONS"])
def confirmar_presenca():
	if request.method == "OPTIONS":
		return ("", 204)

	if not is_guest_authenticated() and not is_session_admin():
		return jsonify({"erro": "Faça login com a senha para confirmar presença."}), 401

	payload = request.get_json(silent=True) or {}
	nome = str(payload.get("nome") or "").strip()
	vai_ao_evento = bool(payload.get("vai_ao_evento", True))
	nome_key = normalize_name_key(nome)

	if not nome_key:
		return jsonify({"erro": "Selecione o seu nome para confirmar presença."}), 400

	with CONVIDADOS_LOCK:
		with CONVIDADOS_FILE_LOCK:
			convidados = load_convidados()
			convidado = next((item for item in convidados if item.get("nome_key") == nome_key), None)

			if not convidado:
				return jsonify({"erro": "Nome não encontrado na lista de convidados."}), 404

			session_name_key = get_current_guest_name_key()
			if session_name_key and session_name_key != nome_key and not is_session_admin():
				return jsonify({"erro": "Esta sessão já está vinculada a outro nome."}), 403

			session["guest_name_key"] = nome_key
			session["guest_nome"] = convidado.get("nome")

			confirmation_time = utc_now().isoformat()
			grupo_nome = str(convidado.get("grupo") or "Sem grupo").strip() or "Sem grupo"
			membros_grupo = [item for item in convidados if (item.get("grupo") or "Sem grupo") == grupo_nome]

			# After first RSVP, the group can only be changed by admins in the admin panel.
			if any(bool(membro.get("presenca_confirmada")) for membro in membros_grupo):
				return jsonify({"erro": "Este grupo já confirmou presença. Para alterar, fale com os noivos (admin)."}), 409

			# RSVP is group-based: one confirmation updates all members in the same family group.
			for membro in membros_grupo:
				membro["presenca_confirmada"] = True
				membro["vai_ao_evento"] = vai_ao_evento
				membro["presenca_confirmada_em"] = confirmation_time

			total_no_grupo = len(membros_grupo)
			confirmados_no_grupo = total_no_grupo
			save_convidados(convidados)

	try:
		send_presence_notification_email(
			grupo_nome,
			convidado.get("nome") or nome,
			vai_ao_evento,
			confirmados_no_grupo,
			total_no_grupo,
		)
		email_status = "notificacao_enviada"
	except Exception as exc:
		app.logger.exception("Falha ao enviar e-mail de confirmacao de presenca")
		email_status = f"notificacao_falhou: {exc}"

	return jsonify(
		{
			"mensagem": f"Presença do grupo '{grupo_nome}' confirmada com sucesso.",
			"convidado": convidado,
			"grupo": grupo_nome,
			"grupo_total": total_no_grupo,
			"grupo_confirmados": confirmados_no_grupo,
			"email_status": email_status,
			"can_access_presentes": can_access_presentes(),
		}
	)


@app.route("/api/presenca/solicitar-alteracao", methods=["POST", "OPTIONS"])
def solicitar_alteracao_presenca():
	if request.method == "OPTIONS":
		return ("", 204)

	if not is_guest_authenticated() and not is_session_admin():
		return jsonify({"erro": "Faça login com a senha para solicitar alteração."}), 401

	payload = request.get_json(silent=True) or {}
	nome = str(payload.get("nome") or "").strip()
	mensagem = str(payload.get("mensagem") or "").strip()
	nome_key = normalize_name_key(nome)

	if not nome_key:
		return jsonify({"erro": "Nome inválido para solicitação de alteração."}), 400

	with CONVIDADOS_LOCK:
		with CONVIDADOS_FILE_LOCK:
			convidados = load_convidados()
			convidado = next((item for item in convidados if item.get("nome_key") == nome_key), None)

			if not convidado:
				return jsonify({"erro": "Convidado não encontrado."}), 404

			session_name_key = get_current_guest_name_key()
			if session_name_key and session_name_key != nome_key and not is_session_admin():
				return jsonify({"erro": "Esta sessão já está vinculada a outro nome."}), 403

			session["guest_name_key"] = nome_key
			session["guest_nome"] = convidado.get("nome")

			if not bool(convidado.get("presenca_confirmada")):
				return jsonify({"erro": "Somente respostas já confirmadas podem solicitar alteração."}), 400

			grupo_nome = str(convidado.get("grupo") or "Sem grupo").strip() or "Sem grupo"

	try:
		send_presence_change_request_email(
			grupo_nome,
			convidado.get("nome") or nome,
			bool(convidado.get("vai_ao_evento")),
			mensagem,
		)
	except Exception as exc:
		app.logger.exception("Falha ao enviar solicitação de alteração de presença")
		return jsonify({"erro": f"Não foi possível enviar o e-mail agora: {exc}"}), 503

	return jsonify(
		{
			"mensagem": "Solicitação enviada aos noivos por e-mail.",
			"grupo": grupo_nome,
			"convidado": convidado.get("nome") or nome,
		}
	)


@app.route("/api/presentes", methods=["GET"])
def listar_presentes():
	if not can_access_presentes():
		return jsonify({"erro": "Confirme sua presença para acessar a lista de presentes."}), 403

	return jsonify(load_presentes())


@app.route("/api/version", methods=["GET"])
def app_version():
	return jsonify(
		{
			"version": APP_VERSION,
			"app_name": "Lista de Presentes de Casamento",
		}
	)


@app.route("/api/pix/gerar", methods=["POST", "OPTIONS"])
def gerar_pix():
	if request.method == "OPTIONS":
		return ("", 204)

	payload = request.get_json(silent=True) or {}
	nome = str(payload.get("nome") or "").strip()
	valor = normalize_preco(payload.get("valor"))
	referencia = str(payload.get("referencia") or "Contribuicao em dinheiro").strip() or "Contribuicao em dinheiro"

	if len(nome) < 3:
		return jsonify({"erro": "Informe seu nome com pelo menos 3 caracteres."}), 400

	if valor is None or valor <= 0:
		return jsonify({"erro": "Informe um valor válido maior que zero."}), 400

	pix_key = clean_credential(os.getenv("PIX_KEY", ""))
	if not pix_key:
		return jsonify({"erro": "PIX indisponível no momento. Configure PIX_KEY no servidor."}), 503

	txid_prefix = normalize_pix_text(os.getenv("PIX_TXID_PREFIX", "CASAMENTO"), 18)
	txid_seed = f"{int(datetime.now(UTC).timestamp()) % 1000000:06d}"
	txid = f"{txid_prefix[:18]}{txid_seed}"[:25]

	pix_payload = build_pix_payload(pix_key, round(float(valor), 2), txid)

	try:
		send_pix_notification_email(nome, round(float(valor), 2), referencia)
		email_status = "notificacao_enviada"
	except Exception as exc:
		app.logger.exception("Falha ao enviar e-mail da contribuição PIX")
		email_status = f"notificacao_falhou: {exc}"

	contribution = append_pix_contribution(
		{
			"nome": nome,
			"valor": round(float(valor), 2),
			"referencia": referencia,
			"txid": txid,
			"criado_em": utc_now().isoformat(),
			"email_status": email_status,
		}
	)

	return jsonify(
		{
			"mensagem": "PIX gerado com sucesso.",
			"nome": nome,
			"valor": round(float(valor), 2),
			"referencia": referencia,
			"pix_key": pix_key,
			"pix_payload": pix_payload,
			"txid": txid,
			"email_status": email_status,
			"contribuicao": contribution,
		}
	)


@app.route("/api/admin/export", methods=["GET"])
def exportar_presentes():
	admin_error = require_admin_auth(request)
	if admin_error:
		return admin_error

	owner_error = require_json_export_owner()
	if owner_error:
		return owner_error

	presentes = load_presentes()
	sync_state = acknowledge_new_products()
	content = json.dumps(presentes, ensure_ascii=False, indent=2)
	filename = f"presentes-export-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"

	return Response(
		content,
		status=200,
		mimetype="application/json",
		headers={
			"Content-Disposition": f'attachment; filename="{filename}"',
			"X-New-Products-Ack-At": sync_state["novos_produtos_ack_em"],
			"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
			"Pragma": "no-cache",
		},
	)


@app.route("/api/admin/metrics", methods=["GET"])
def admin_metrics():
	admin_error = require_admin_auth(request)
	if admin_error:
		return admin_error

	presentes = load_presentes()
	total = len(presentes)
	reservados = [item for item in presentes if item.get("reservado")]
	disponiveis = total - len(reservados)
	valor_total = sum(float(item.get("preco", 0) or 0) for item in presentes)
	valor_reservado = sum(float(item.get("preco", 0) or 0) for item in reservados)

	ultimas_reservas = sorted(
		reservados,
		key=lambda item: item.get("reservado_em", ""),
		reverse=True,
	)[:5]

	ultimas_reservas_payload = [
		{
			"id": item.get("id"),
			"nome": item.get("nome"),
			"preco": float(item.get("preco", 0) or 0),
			"reservado_por_nome": item.get("reservado_por_nome") or "Não informado",
			"reservado_em": item.get("reservado_em") or "",
		}
		for item in ultimas_reservas
	]

	presence = get_active_admin_sessions_payload()
	sync_state = load_admin_sync_state()
	pending_new_products = get_pending_new_products(presentes, sync_state.get("novos_produtos_ack_em"))
	convidados = load_convidados()
	pending_new_guests = get_pending_new_guests(convidados, sync_state.get("novos_convidados_ack_em"))
	pix_contributions = load_pix_contributions()
	pix_total = len(pix_contributions)
	pix_valor_total = round(sum(float(item.get("valor", 0) or 0) for item in pix_contributions), 2)
	ultimas_pix = sorted(
		pix_contributions,
		key=lambda item: item.get("criado_em", ""),
		reverse=True,
	)[:8]
	ultimas_pix_payload = [
		{
			"id": item.get("id"),
			"nome": item.get("nome") or "Não informado",
			"valor": float(item.get("valor", 0) or 0),
			"referencia": item.get("referencia") or "Contribuicao em dinheiro",
			"txid": item.get("txid") or "",
			"criado_em": item.get("criado_em") or "",
			"email_status": item.get("email_status") or "",
		}
		for item in ultimas_pix
	]

	unreserve_entries = load_unreserve_entries()
	ultimas_desmarcacoes = sorted(
		unreserve_entries,
		key=lambda item: item.get("desmarcado_em", ""),
		reverse=True,
	)[:8]
	ultimas_desmarcacoes_payload = [
		{
			"id": item.get("id"),
			"presente_id": int(item.get("presente_id") or 0),
			"presente_nome": item.get("presente_nome") or "Presente",
			"reservado_por_nome": item.get("reservado_por_nome") or "Não informado",
			"desmarcado_por": item.get("desmarcado_por") or "admin",
			"desmarcado_em": item.get("desmarcado_em") or "",
		}
		for item in ultimas_desmarcacoes
	]

	response = jsonify(
		{
			"total": total,
			"disponiveis": disponiveis,
			"reservados": len(reservados),
			"percentual_reservado": round((len(reservados) / total) * 100, 1) if total else 0,
			"valor_total": round(valor_total, 2),
			"valor_reservado": round(valor_reservado, 2),
			"ultimas_reservas": ultimas_reservas_payload,
			"novos_produtos_pendentes_total": len(pending_new_products),
			"novos_produtos_pendentes": pending_new_products[:8],
			"novos_produtos_ack_em": sync_state.get("novos_produtos_ack_em") or "",
			"novos_convidados_pendentes_total": len(pending_new_guests),
			"novos_convidados_pendentes": pending_new_guests[:8],
			"novos_convidados_ack_em": sync_state.get("novos_convidados_ack_em") or "",
			"ultimo_export_em": sync_state.get("ultimo_export_em") or "",
			"ultimo_export_convidados_em": sync_state.get("ultimo_export_convidados_em") or "",
			"pix_contribuicoes_total": pix_total,
			"pix_contribuicoes_valor_total": pix_valor_total,
			"ultimas_contribuicoes_pix": ultimas_pix_payload,
			"ultimas_desmarcacoes_reserva": ultimas_desmarcacoes_payload,
			"admins_ativos_total": presence["total"],
			"admins_ativos": presence["sessions"],
			"admins_ativos_ttl_segundos": presence["ttl_segundos"],
		}
	)
	response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
	response.headers["Pragma"] = "no-cache"
	return response


@app.route("/api/admin/presence", methods=["GET"])
def admin_presence():
	admin_error = require_admin_auth(request)
	if admin_error:
		return admin_error

	return jsonify(get_active_admin_sessions_payload())


@app.route("/api/admin/session", methods=["GET"])
def admin_session_status():
	if is_session_admin():
		touch_admin_session(str(session.get("admin_email") or ""), str(session.get("admin_session_id") or ""))
		return jsonify({"authenticated": True, "email": session.get("admin_email")})

	return jsonify({"authenticated": False})


@app.route("/api/admin/login", methods=["POST", "OPTIONS"])
def admin_login():
	if request.method == "OPTIONS":
		return ("", 204)

	payload = request.get_json(silent=True) or {}
	email = clean_credential(payload.get("email") or "").lower()
	password = clean_credential(payload.get("password") or "")
	users = get_admin_users()

	if not users:
		return jsonify({"erro": "Nenhum administrador configurado no servidor. Defina ADMIN_USER_1_EMAIL e ADMIN_USER_1_PASSWORD no Render."}), 503

	if not email or not password:
		return jsonify({"erro": "Informe e-mail e senha."}), 400

	if email not in users or not hmac.compare_digest(password, users[email]):
		return jsonify({"erro": "Credenciais inválidas."}), 401

	session_id = uuid.uuid4().hex
	# Reset any previous guest session so admin access starts clean.
	session.pop("guest_authenticated", None)
	session.pop("guest_name_key", None)
	session.pop("guest_nome", None)
	session["admin_email"] = email
	session["admin_session_id"] = session_id
	touch_admin_session(email, session_id)

	return jsonify({"mensagem": "Login realizado com sucesso.", "email": email})


@app.route("/api/admin/logout", methods=["POST", "OPTIONS"])
def admin_logout():
	if request.method == "OPTIONS":
		return ("", 204)

	remove_admin_session(session.get("admin_session_id"))
	session.pop("admin_email", None)
	session.pop("admin_session_id", None)
	# Also clear guest session flags to avoid stale access state.
	session.pop("guest_authenticated", None)
	session.pop("guest_name_key", None)
	session.pop("guest_nome", None)
	return jsonify({"mensagem": "Logout realizado com sucesso."})


@app.route("/api/admin/convidados", methods=["GET"])
def listar_convidados_admin():
	admin_error = require_admin_auth(request)
	if admin_error:
		return admin_error

	convidados = load_convidados()
	payload = [build_convidado_payload(item) for item in convidados]
	payload.sort(key=lambda item: (0 if item.get("grupo") == "Noivos" else 1, item.get("grupo", ""), item.get("nome", "")))
	return jsonify(payload)


@app.route("/api/admin/convidados/resumo", methods=["GET"])
def resumo_convidados_admin():
	admin_error = require_admin_auth(request)
	if admin_error:
		return admin_error

	convidados = load_convidados()
	sync_state = load_admin_sync_state()
	pending_new_guests = get_pending_new_guests(convidados, sync_state.get("novos_convidados_ack_em"))

	return jsonify(
		{
			"total": len(convidados),
			"novos_convidados_pendentes_total": len(pending_new_guests),
			"novos_convidados_pendentes": pending_new_guests[:8],
			"novos_convidados_ack_em": sync_state.get("novos_convidados_ack_em") or "",
			"ultimo_export_convidados_em": sync_state.get("ultimo_export_convidados_em") or "",
		}
	)


@app.route("/api/admin/convidados/export", methods=["GET"])
def exportar_convidados_admin():
	admin_error = require_admin_auth(request)
	if admin_error:
		return admin_error

	owner_error = require_json_export_owner()
	if owner_error:
		return owner_error

	convidados = load_convidados()
	sync_state = acknowledge_new_guests()
	content = json.dumps(convidados, ensure_ascii=False, indent=2)
	filename = f"convidados-export-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"

	return Response(
		content,
		status=200,
		mimetype="application/json",
		headers={
			"Content-Disposition": f'attachment; filename="{filename}"',
			"X-New-Guests-Ack-At": sync_state["novos_convidados_ack_em"],
			"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
			"Pragma": "no-cache",
		},
	)


@app.route("/api/admin/convidados", methods=["POST", "OPTIONS"])
def criar_convidado_admin():
	if request.method == "OPTIONS":
		return ("", 204)

	admin_error = require_admin_auth(request)
	if admin_error:
		return admin_error

	payload = request.get_json(silent=True) or {}
	nome = str(payload.get("nome") or "").strip()
	grupo = str(payload.get("grupo") or "Sem grupo").strip() or "Sem grupo"
	tipo = str(payload.get("tipo") or "convidado").strip().lower()
	status_presenca = str(payload.get("status_presenca") or "pendente").strip().lower()

	if len(nome) < 3:
		return jsonify({"erro": "Informe o nome do convidado com pelo menos 3 caracteres."}), 400

	if tipo not in {"convidado", "noivos"}:
		return jsonify({"erro": "Tipo inválido."}), 400

	if status_presenca not in {"pendente", "confirmado", "nao_vai"}:
		return jsonify({"erro": "Status de presença inválido."}), 400

	with CONVIDADOS_LOCK:
		with CONVIDADOS_FILE_LOCK:
			convidados = load_convidados()
			novo_id = max((int(item.get("id", 0)) for item in convidados), default=0) + 1

			novo_convidado = normalize_convidado(
				{
					"id": novo_id,
					"nome": nome,
					"grupo": grupo,
					"tipo": tipo,
					"criado_em": utc_now().isoformat(),
					"presenca_confirmada": status_presenca in {"confirmado", "nao_vai"},
					"vai_ao_evento": status_presenca == "confirmado",
					"presenca_confirmada_em": utc_now().isoformat() if status_presenca in {"confirmado", "nao_vai"} else "",
				}
			)

			convidados.append(novo_convidado)
			save_convidados(convidados)

	return jsonify({"mensagem": "Convidado adicionado com sucesso.", "convidado": build_convidado_payload(novo_convidado)}), 201


@app.route("/api/admin/convidados/<int:convidado_id>", methods=["PUT", "OPTIONS"])
def atualizar_convidado_admin(convidado_id):
	if request.method == "OPTIONS":
		return ("", 204)

	admin_error = require_admin_auth(request)
	if admin_error:
		return admin_error

	payload = request.get_json(silent=True) or {}
	nome = str(payload.get("nome") or "").strip()
	grupo = str(payload.get("grupo") or "Sem grupo").strip() or "Sem grupo"
	tipo = str(payload.get("tipo") or "convidado").strip().lower()
	status_presenca = str(payload.get("status_presenca") or "pendente").strip().lower()

	if len(nome) < 3:
		return jsonify({"erro": "Informe o nome do convidado com pelo menos 3 caracteres."}), 400

	if tipo not in {"convidado", "noivos"}:
		return jsonify({"erro": "Tipo inválido."}), 400

	if status_presenca not in {"pendente", "confirmado", "nao_vai"}:
		return jsonify({"erro": "Status de presença inválido."}), 400

	with CONVIDADOS_LOCK:
		with CONVIDADOS_FILE_LOCK:
			convidados = load_convidados()
			convidado = next((item for item in convidados if int(item.get("id", 0)) == convidado_id), None)

			if not convidado:
				return jsonify({"erro": "Convidado não encontrado."}), 404

			convidado["nome"] = nome
			convidado["nome_key"] = normalize_name_key(nome)
			convidado["grupo"] = grupo
			convidado["tipo"] = tipo

			if status_presenca == "pendente":
				convidado["presenca_confirmada"] = False
				convidado["vai_ao_evento"] = False
				convidado["presenca_confirmada_em"] = ""
			elif status_presenca == "confirmado":
				convidado["presenca_confirmada"] = True
				convidado["vai_ao_evento"] = True
				convidado["presenca_confirmada_em"] = convidado.get("presenca_confirmada_em") or utc_now().isoformat()
			else:
				convidado["presenca_confirmada"] = True
				convidado["vai_ao_evento"] = False
				convidado["presenca_confirmada_em"] = convidado.get("presenca_confirmada_em") or utc_now().isoformat()

			save_convidados(convidados)

	return jsonify({"mensagem": "Convidado atualizado com sucesso.", "convidado": build_convidado_payload(convidado)})


@app.route("/api/admin/convidados/<int:convidado_id>", methods=["DELETE", "OPTIONS"])
def remover_convidado_admin(convidado_id):
	if request.method == "OPTIONS":
		return ("", 204)

	admin_error = require_admin_auth(request)
	if admin_error:
		return admin_error

	with CONVIDADOS_LOCK:
		with CONVIDADOS_FILE_LOCK:
			convidados = load_convidados()
			before_count = len(convidados)
			convidados = [item for item in convidados if int(item.get("id", 0)) != convidado_id]

			if len(convidados) == before_count:
				return jsonify({"erro": "Convidado não encontrado."}), 404

			convidados = normalize_all_convidados(convidados)
			save_convidados(convidados)

	if get_current_guest_name_key() and get_current_guest_name_key() not in {item.get("nome_key") for item in convidados}:
		session.pop("guest_name_key", None)
		session.pop("guest_nome", None)

	return jsonify({"mensagem": "Convidado removido com sucesso."})


@app.route("/api/presentes", methods=["POST", "OPTIONS"])
def criar_presente():
	if request.method == "OPTIONS":
		return ("", 204)

	admin_error = require_admin_auth(request)
	if admin_error:
		return admin_error

	payload = request.get_json(silent=True) or {}
	nome = str(payload.get("nome") or "").strip()
	preco = normalize_preco(payload.get("preco"))

	if len(nome) < 3:
		return jsonify({"erro": "Informe um nome de presente com pelo menos 3 caracteres."}), 400

	if preco is None or preco < 0:
		return jsonify({"erro": "Informe um preço válido."}), 400

	with PRESENTES_LOCK:
		with PRESENTES_FILE_LOCK:
			presentes = load_presentes()
			novo = normalize_presente(
				{
					"id": next_presente_id(presentes),
					"nome": nome,
					"descricao": payload.get("descricao"),
					"categoria": payload.get("categoria") or "Geral",
					"preco": preco,
					"foto_url": payload.get("foto_url") or DEFAULT_IMAGE_URL,
					"produto_url": payload.get("produto_url") or "",
					"especificacoes": payload.get("especificacoes") or [],
					"criado_em": utc_now().isoformat(),
					"reservado": False,
				}
			)

			presentes.append(novo)
			save_presentes(presentes)

	return jsonify({"mensagem": "Presente adicionado com sucesso.", "presente": novo}), 201


@app.route("/api/presentes/<int:presente_id>", methods=["PUT", "OPTIONS"])
def atualizar_presente(presente_id):
	if request.method == "OPTIONS":
		return ("", 204)

	admin_error = require_admin_auth(request)
	if admin_error:
		return admin_error

	payload = request.get_json(silent=True) or {}
	nome = str(payload.get("nome") or "").strip()
	preco = normalize_preco(payload.get("preco"))

	if len(nome) < 3:
		return jsonify({"erro": "Informe um nome de presente com pelo menos 3 caracteres."}), 400

	if preco is None or preco < 0:
		return jsonify({"erro": "Informe um preço válido."}), 400

	with PRESENTES_LOCK:
		with PRESENTES_FILE_LOCK:
			presentes = load_presentes()
			presente = next((item for item in presentes if int(item.get("id", 0)) == presente_id), None)

			if not presente:
				return jsonify({"erro": "Presente não encontrado."}), 404

			presente["nome"] = nome
			presente["descricao"] = str(payload.get("descricao") or "").strip()
			presente["categoria"] = str(payload.get("categoria") or "Geral").strip() or "Geral"
			presente["preco"] = round(preco, 2)
			presente["foto_url"] = str(payload.get("foto_url") or DEFAULT_IMAGE_URL).strip() or DEFAULT_IMAGE_URL
			presente["produto_url"] = str(payload.get("produto_url") or "").strip()
			presente["especificacoes"] = normalize_especificacoes(payload.get("especificacoes") or [])

			save_presentes(presentes)

	return jsonify({"mensagem": "Presente atualizado com sucesso.", "presente": presente})


@app.route("/api/presentes/<int:presente_id>", methods=["DELETE", "OPTIONS"])
def remover_presente(presente_id):
	if request.method == "OPTIONS":
		return ("", 204)

	admin_error = require_admin_auth(request)
	if admin_error:
		return admin_error

	with PRESENTES_LOCK:
		with PRESENTES_FILE_LOCK:
			presentes = load_presentes()
			before_count = len(presentes)
			presentes = [item for item in presentes if int(item.get("id")) != presente_id]

			if len(presentes) == before_count:
				return jsonify({"erro": "Presente não encontrado."}), 404

			# Reindex to keep ids sequential in a file-based storage.
			presentes = normalize_all_presentes(presentes)
			save_presentes(presentes)

	return jsonify({"mensagem": "Presente removido com sucesso."})


@app.route("/api/presentes/<int:presente_id>/reservar", methods=["POST", "OPTIONS"])
def reservar_presente(presente_id):
	if request.method == "OPTIONS":
		return ("", 204)

	if not can_access_presentes():
		return jsonify({"erro": "Confirme sua presença antes de reservar presentes."}), 403

	payload = request.get_json(silent=True) or {}
	nome = (payload.get("nome") or "").strip()
	email = (payload.get("email") or "").strip().lower()

	if len(nome) < 3:
		return jsonify({"erro": "Informe um nome válido."}), 400

	if email and not EMAIL_REGEX.match(email):
		return jsonify({"erro": "Se informado, o e-mail deve ser válido."}), 400

	with PRESENTES_LOCK:
		with PRESENTES_FILE_LOCK:
			presentes = load_presentes()
			presente = next((p for p in presentes if p.get("id") == presente_id), None)

			if not presente:
				return jsonify({"erro": "Presente não encontrado."}), 404

			if presente.get("reservado"):
				return jsonify({"erro": "Esse presente já foi reservado."}), 409

			presente["reservado"] = True
			presente["reservado_por_nome"] = nome
			if email:
				presente["reservado_por_email"] = email
			else:
				presente.pop("reservado_por_email", None)
			presente["reservado_em"] = datetime.now(UTC).isoformat()
			save_presentes(presentes)

	try:
		send_notification_email(presente, nome, email)
		email_status = "notificacao_enviada"
	except Exception as exc:
		app.logger.exception("Falha ao enviar e-mail de notificacao da reserva")
		email_status = f"notificacao_falhou: {exc}"

	return jsonify(
		{
			"mensagem": "Presente reservado com sucesso.",
			"email_status": email_status,
			"presente": presente,
		}
	)


@app.route("/api/presentes/<int:presente_id>/desreservar", methods=["POST", "OPTIONS"])
def desreservar_presente(presente_id):
	if request.method == "OPTIONS":
		return ("", 204)

	admin_error = require_admin_auth(request)
	if admin_error:
		return admin_error

	with PRESENTES_LOCK:
		with PRESENTES_FILE_LOCK:
			presentes = load_presentes()
			presente = next((p for p in presentes if p.get("id") == presente_id), None)

			if not presente:
				return jsonify({"erro": "Presente não encontrado."}), 404

			if not presente.get("reservado"):
				return jsonify({"erro": "Esse presente já está disponível."}), 409

			previous_nome = str(presente.get("reservado_por_nome") or "Não informado").strip()
			previous_email = str(presente.get("reservado_por_email") or "").strip().lower()
			admin_actor = str(session.get("admin_email") or "").strip().lower() or "admin-token"

			presente["reservado"] = False
			presente.pop("reservado_por_nome", None)
			presente.pop("reservado_por_email", None)
			presente.pop("reservado_em", None)
			save_presentes(presentes)

	append_unreserve_entry(
		{
			"presente_id": presente_id,
			"presente_nome": presente.get("nome") or "Presente",
			"reservado_por_nome": previous_nome,
			"reservado_por_email": previous_email,
			"desmarcado_por": admin_actor,
			"desmarcado_em": utc_now().isoformat(),
		}
	)

	return jsonify({"mensagem": "Reserva removida com sucesso.", "presente": presente})


if __name__ == "__main__":
	port = int(os.getenv("PORT", "5000"))
	debug = os.getenv("FLASK_DEBUG", "0") == "1"
	app.run(host="0.0.0.0", port=port, debug=debug)
