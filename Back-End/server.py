import json
import hmac
import os
import re
import smtplib
from datetime import UTC
from decimal import Decimal, InvalidOperation
from datetime import datetime
from email.mime.text import MIMEText
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, session


ROOT_DIR = Path(__file__).resolve().parent.parent
HTML_DIR = ROOT_DIR / "HTML"
CSS_DIR = ROOT_DIR / "CSS"
JS_DIR = ROOT_DIR / "JS"
DATA_FILE = Path(__file__).resolve().parent / "presentes.json"
DATA_FILE = Path(os.getenv("DATA_FILE_PATH", str(DATA_FILE)))
ENV_FILE = Path(__file__).resolve().parent / ".env"
DEFAULT_IMAGE_URL = "https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=900&q=80"

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

app = Flask(__name__)


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

app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-me")


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
		"especificacoes": normalize_especificacoes(raw.get("especificacoes")),
		"reservado": bool(raw.get("reservado", False)),
	}

	if raw.get("reservado_por_nome"):
		normalized["reservado_por_nome"] = str(raw.get("reservado_por_nome")).strip()
	if raw.get("reservado_por_email"):
		normalized["reservado_por_email"] = str(raw.get("reservado_por_email")).strip().lower()
	if raw.get("reservado_em"):
		normalized["reservado_em"] = str(raw.get("reservado_em")).strip()

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


def get_admin_users():
	users = {}
	for index in (1, 2):
		email = os.getenv(f"ADMIN_USER_{index}_EMAIL", "").strip().lower()
		password = os.getenv(f"ADMIN_USER_{index}_PASSWORD", "")
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
	if has_valid_admin_token(request_obj) or is_session_admin():
		return None

	return jsonify({"erro": "Acesso restrito. Faça login como administrador."}), 401


def load_presentes():
	if not DATA_FILE.exists():
		base = default_presentes()
		save_presentes(base)
		return base

	with DATA_FILE.open("r", encoding="utf-8") as file:
		loaded = json.load(file)

	normalized = normalize_all_presentes(loaded)
	if normalized != loaded:
		save_presentes(normalized)

	return normalized


def save_presentes(presentes):
	DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
	with DATA_FILE.open("w", encoding="utf-8") as file:
		json.dump(presentes, file, ensure_ascii=False, indent=2)


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


@app.after_request
def add_cors_headers(response):
	response.headers["Access-Control-Allow-Origin"] = "*"
	response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
	response.headers["Access-Control-Allow-Headers"] = "Content-Type,X-Admin-Token"
	return response


@app.route("/", methods=["GET"])
def index():
	return send_from_directory(HTML_DIR, "lista.html")


@app.route("/admin", methods=["GET"])
def admin_page():
	return send_from_directory(HTML_DIR, "admin.html")


@app.route("/CSS/<path:filename>", methods=["GET"])
def css_files(filename):
	return send_from_directory(CSS_DIR, filename)


@app.route("/JS/<path:filename>", methods=["GET"])
def js_files(filename):
	return send_from_directory(JS_DIR, filename)


@app.route("/api/presentes", methods=["GET"])
def listar_presentes():
	return jsonify(load_presentes())


@app.route("/api/admin/session", methods=["GET"])
def admin_session_status():
	if is_session_admin():
		return jsonify({"authenticated": True, "email": session.get("admin_email")})

	return jsonify({"authenticated": False})


@app.route("/api/admin/login", methods=["POST", "OPTIONS"])
def admin_login():
	if request.method == "OPTIONS":
		return ("", 204)

	payload = request.get_json(silent=True) or {}
	email = str(payload.get("email") or "").strip().lower()
	password = str(payload.get("password") or "")
	users = get_admin_users()

	if not email or not password:
		return jsonify({"erro": "Informe e-mail e senha."}), 400

	if email not in users or not hmac.compare_digest(password, users[email]):
		return jsonify({"erro": "Credenciais inválidas."}), 401

	session["admin_email"] = email

	return jsonify({"mensagem": "Login realizado com sucesso.", "email": email})


@app.route("/api/admin/logout", methods=["POST", "OPTIONS"])
def admin_logout():
	if request.method == "OPTIONS":
		return ("", 204)

	session.pop("admin_email", None)
	return jsonify({"mensagem": "Logout realizado com sucesso."})


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

	presentes = load_presentes()
	novo = normalize_presente(
		{
			"id": next_presente_id(presentes),
			"nome": nome,
			"descricao": payload.get("descricao"),
			"categoria": payload.get("categoria") or "Geral",
			"preco": preco,
			"foto_url": payload.get("foto_url") or DEFAULT_IMAGE_URL,
			"especificacoes": payload.get("especificacoes") or [],
			"reservado": False,
		}
	)

	presentes.append(novo)
	save_presentes(presentes)

	return jsonify({"mensagem": "Presente adicionado com sucesso.", "presente": novo}), 201


@app.route("/api/presentes/<int:presente_id>", methods=["DELETE", "OPTIONS"])
def remover_presente(presente_id):
	if request.method == "OPTIONS":
		return ("", 204)

	admin_error = require_admin_auth(request)
	if admin_error:
		return admin_error

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

	payload = request.get_json(silent=True) or {}
	nome = (payload.get("nome") or "").strip()
	email = (payload.get("email") or "").strip().lower()

	if len(nome) < 3:
		return jsonify({"erro": "Informe um nome válido."}), 400

	if not EMAIL_REGEX.match(email):
		return jsonify({"erro": "Informe um e-mail válido."}), 400

	presentes = load_presentes()
	presente = next((p for p in presentes if p.get("id") == presente_id), None)

	if not presente:
		return jsonify({"erro": "Presente não encontrado."}), 404

	if presente.get("reservado"):
		return jsonify({"erro": "Esse presente já foi reservado."}), 409

	presente["reservado"] = True
	presente["reservado_por_nome"] = nome
	presente["reservado_por_email"] = email
	presente["reservado_em"] = datetime.now(UTC).isoformat()
	save_presentes(presentes)

	try:
		send_notification_email(presente, nome, email)
		email_status = "notificacao_enviada"
	except Exception as exc:
		email_status = f"notificacao_falhou: {exc}"

	return jsonify(
		{
			"mensagem": "Presente reservado com sucesso.",
			"email_status": email_status,
			"presente": presente,
		}
	)


if __name__ == "__main__":
	port = int(os.getenv("PORT", "5000"))
	debug = os.getenv("FLASK_DEBUG", "0") == "1"
	app.run(host="0.0.0.0", port=port, debug=debug)
