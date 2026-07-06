#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rutina de Jessi — correo semanal de progresion.

Cada lunes lee las rutinas desde Firestore, calcula la progresion de la
semana (misma logica que la app: +1 repeticion; al pasar de 12 reps baja a 8
y sube el peso: +5 kg / +10 lb / +1 nivel) y envia un correo con los cambios.

No modifica la base de datos: solo lee y envia el resumen ("objetivos de la semana").

Variables de entorno necesarias (se configuran como GitHub Secrets):
  FIREBASE_PROJECT_ID   -> asesoriasjessi
  FIREBASE_API_KEY      -> la Web API Key del proyecto
  GMAIL_USER            -> tu correo de Gmail que envia (ej. tucorreo@gmail.com)
  GMAIL_APP_PASSWORD    -> App Password de Gmail (16 caracteres, sin espacios)
  TO_EMAIL              -> destino (por defecto lorenzohugo33@gmail.com)
"""

import os
import re
import ssl
import smtplib
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import requests

PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "asesoriasjessi")
API_KEY = os.environ.get("FIREBASE_API_KEY", "")
GMAIL_USER = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
TO_EMAIL = os.environ.get("TO_EMAIL", "lorenzohugo33@gmail.com")

FIRESTORE_BASE = (
    "https://firestore.googleapis.com/v1/projects/"
    f"{PROJECT_ID}/databases/(default)/documents"
)


# ----------------------- Lectura de Firestore (REST) -----------------------

def _decode_value(v):
    """Convierte un valor tipado de Firestore REST a Python nativo."""
    if "stringValue" in v:
        return v["stringValue"]
    if "integerValue" in v:
        return int(v["integerValue"])
    if "doubleValue" in v:
        return v["doubleValue"]
    if "booleanValue" in v:
        return v["booleanValue"]
    if "nullValue" in v:
        return None
    if "arrayValue" in v:
        return [_decode_value(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v:
        return {k: _decode_value(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return None


def _decode_fields(fields):
    return {k: _decode_value(v) for k, v in (fields or {}).items()}


def fetch_rutinas():
    """Devuelve la lista de rutinas (documentos de la coleccion 'rutinas')."""
    url = f"{FIRESTORE_BASE}/rutinas?key={API_KEY}&pageSize=300"
    docs = []
    while url:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        data = r.json()
        for d in data.get("documents", []):
            doc = _decode_fields(d.get("fields", {}))
            doc["_id"] = d["name"].split("/")[-1]
            docs.append(doc)
        token = data.get("nextPageToken")
        url = (
            f"{FIRESTORE_BASE}/rutinas?key={API_KEY}&pageSize=300&pageToken={token}"
            if token else None
        )
    docs = [d for d in docs if not d.get("archivada")]
    docs.sort(key=lambda d: d.get("orden", 0))
    return docs


# ----------------------- Logica de progresion (igual a la app) -------------

def bump_weight(peso):
    s = ("" if peso is None else str(peso)).strip()
    if not s:
        return s
    low = s.lower()
    m = re.search(r"-?\d+(\.\d+)?", s)
    if not m:
        return s
    n = float(m.group(0))
    inc = 10  # por defecto lb
    if "kg" in low:
        inc = 5
    elif "nivel" in low:
        inc = 1
    elif "lb" in low:
        inc = 10
    nv = round((n + inc) * 100) / 100
    if nv == int(nv):
        nv = int(nv)
    return s.replace(m.group(0), str(nv))


def progress_serie(se):
    try:
        reps = int(str(se.get("reps", "")).strip())
    except (ValueError, TypeError):
        reps = 7
    peso = "" if se.get("peso") is None else str(se.get("peso"))
    reps += 1
    if reps > 12:
        reps = 8
        peso = bump_weight(peso)
    return {"peso": peso, "reps": str(reps)}


def norm_series(e):
    if isinstance(e.get("series"), list) and e["series"]:
        return [
            {
                "peso": "" if s.get("peso") is None else str(s.get("peso")),
                "reps": "" if s.get("reps") is None else str(s.get("reps")),
            }
            for s in e["series"]
        ]
    try:
        n = int(str(e.get("sets", "")).strip())
    except (ValueError, TypeError):
        n = 1
    if n < 1:
        n = 1
    peso = "" if e.get("peso") is None else str(e.get("peso"))
    reps = "" if e.get("reps") is None else str(e.get("reps"))
    return [{"peso": peso, "reps": reps} for _ in range(n)]


def serie_str(s):
    return f"{s.get('peso') or '—'} x {s.get('reps') or '—'}"


def compute_changes(rutinas):
    """Devuelve lista de cambios por dia/ejercicio/serie."""
    changes = []
    for r in rutinas:
        day_changes = []
        for e in r.get("ejercicios", []) or []:
            before = norm_series(e)
            after = [progress_serie(s) for s in before]
            diffs = []
            for k in range(len(after)):
                b, a = before[k], after[k]
                if b["peso"] != a["peso"] or str(b["reps"]) != str(a["reps"]):
                    diffs.append({"serie": k + 1, "de": serie_str(b), "a": serie_str(a)})
            if diffs:
                day_changes.append({"ejercicio": e.get("nombre") or "Ejercicio", "diffs": diffs})
        if day_changes:
            changes.append({"dia": r.get("nombre") or "Dia", "ejercicios": day_changes})
    return changes


# ----------------------- Construccion del correo ---------------------------

def week_label(today=None):
    today = today or datetime.date.today()
    iso = today.isocalendar()
    return f"{iso[0]}-W{iso[1]}"


def build_plain(changes, wk):
    lines = ["RUTINA DE JESSI", f"Objetivos de la semana {wk}", ""]
    for d in changes:
        lines.append(f"== {d['dia']} ==")
        for ex in d["ejercicios"]:
            lines.append(f"  {ex['ejercicio']}")
            for df in ex["diffs"]:
                lines.append(f"    Serie {df['serie']}: {df['de']}  ->  {df['a']}")
        lines.append("")
    lines.append("Estos son los nuevos objetivos aplicados automaticamente esta semana.")
    lines.append("Abre la app para verlos y registrar tu progreso.")
    return "\n".join(lines)


def build_html(changes, wk):
    rows = []
    for d in changes:
        rows.append(
            f'<h2 style="font-family:Arial,sans-serif;color:#C1121F;'
            f'border-bottom:2px solid #F0C64A;padding-bottom:6px;margin:22px 0 10px;">'
            f'🎭 {d["dia"]}</h2>'
        )
        for ex in d["ejercicios"]:
            rows.append(
                f'<p style="font-family:Arial,sans-serif;font-weight:bold;'
                f'color:#222;margin:12px 0 4px;">{ex["ejercicio"]}</p>'
            )
            items = "".join(
                f'<li style="font-family:Arial,sans-serif;color:#444;margin:2px 0;">'
                f'Serie {df["serie"]}: <span style="color:#999;">{df["de"]}</span> '
                f'&rarr; <b style="color:#B8860B;">{df["a"]}</b></li>'
                for df in ex["diffs"]
            )
            rows.append(f'<ul style="margin:0 0 8px;padding-left:20px;">{items}</ul>')
    body = "".join(rows)
    return f"""<!DOCTYPE html><html><body style="background:#0b0808;margin:0;padding:24px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;
padding:26px;border-top:6px solid #C1121F;">
<div style="text-align:center;">
<div style="font-size:30px;">🎭🤼🎭</div>
<h1 style="font-family:Arial,sans-serif;color:#0b0808;letter-spacing:1px;margin:8px 0 2px;">
RUTINA DE JESSI</h1>
<div style="font-family:Arial,sans-serif;color:#C9962B;font-weight:bold;
letter-spacing:2px;font-size:13px;">OBJETIVOS DE LA SEMANA {wk}</div>
</div>
{body}
<p style="font-family:Arial,sans-serif;color:#888;font-size:12px;
margin-top:24px;border-top:1px solid #eee;padding-top:14px;">
Estos objetivos se aplicaron automaticamente esta semana. Abre la app para
registrar tu progreso. 🏆</p>
</div></body></html>"""


def send_email(subject, plain, html):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = GMAIL_USER
    msg["To"] = TO_EMAIL
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx) as server:
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_USER, [TO_EMAIL], msg.as_string())


# ----------------------- Main ----------------------------------------------

def main():
    missing = [n for n in ("FIREBASE_API_KEY", "GMAIL_USER", "GMAIL_APP_PASSWORD")
               if not os.environ.get(n)]
    if missing:
        raise SystemExit("Faltan variables de entorno: " + ", ".join(missing))

    wk = week_label()
    rutinas = fetch_rutinas()
    changes = compute_changes(rutinas)

    if not changes:
        print("No hay cambios de progresion esta semana. No se envia correo.")
        return

    subject = f"Rutina de Jessi — objetivos de la semana {wk}"
    plain = build_plain(changes, wk)
    html = build_html(changes, wk)
    send_email(subject, plain, html)
    print(f"Correo enviado a {TO_EMAIL} con {len(changes)} dia(s) de cambios.")


if __name__ == "__main__":
    main()
