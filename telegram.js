// /api/telegram.js – Vercel Serverless Function
// Chatbot Telegram: Misiones Universitarias – UTPL (Voluntariado)

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// ---- Base de conocimiento (puedes luego reemplazar por Google Sheets/Mongo) ----
const DB = {
  centros: [
    { nombre: "Centro A", direccion: "Barrio San Pedro, Loja", actividades: "Apoyo escolar y lúdico" },
    { nombre: "Centro B", direccion: "Av. Universitaria 123, Loja", actividades: "Acompañamiento a adultos mayores" },
  ],
  horarios: {
    "Centro A": "Lun-Mié-Vie 14:30–17:30",
    "Centro B": "Mar-Jue 09:00–12:00",
  },
  tutores: {
    "Centro A": { nombre: "Ing. María Pérez", contacto: "maria.perez@utpl.edu.ec" },
    "Centro B": { nombre: "Lic. Jorge Ruiz",  contacto: "jorge.ruiz@utpl.edu.ec" },
  },
  requisitos: [
    "Ser estudiante UTPL",
    "Completar formulario de inscripción",
    "Compromiso mínimo de 2–4 h/semana",
  ],
  contactoDepartamento: "misiones@utpl.edu.ec",
};

// ---- Utilidades Telegram ----
async function tg(method, payload) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error("TG error:", await res.text());
}

function mainMenu() {
  return {
    keyboard: [
      [{ text: "Centros" }, { text: "Horarios" }],
      [{ text: "Tutores" }, { text: "Requisitos" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

async function send(chat_id, text, options = {}) {
  return tg("sendMessage", {
    chat_id,
    text,
    parse_mode: "Markdown",
    ...options,
  });
}

// ---- NLU simple por palabras clave / opciones ----
function detectIntent(t = "") {
  const s = t.toLowerCase().trim();
  if (s === "/start") return "start";
  if (s === "centros" || /(centro|centros|lugares|ubicaci[oó]n|dónde)/.test(s)) return "centros";
  if (s === "horarios" || /(horario|horarios|cu[aá]ndo|a qu[eé] hora)/.test(s)) return "horarios";
  if (s === "tutores" || /(tutor|encargad|responsable)/.test(s)) return "tutores";
  if (s === "requisitos" || /(requisito|inscrip|requer|qu[eé] necesito)/.test(s)) return "requisitos";
  if (/menu|men[uú]|opciones|ayuda/.test(s)) return "menu";
  return "fallback";
}

// ---- Respuestas de dominio ----
function replyCentros() {
  const lines = DB.centros.map(
    c => `• *${c.nombre}* — ${c.direccion}\n   Actividades: ${c.actividades}`
  );
  return [
    "📍 *Centros de Voluntariado en Loja*",
    ...lines,
    "",
    "¿Te interesa alguno? Dime el *nombre del centro* para ver horarios y tutor.",
  ].join("\n");
}

function replyHorarios(text) {
  const centros = Object.keys(DB.horarios);
  const found = centros.find(c => text.toLowerCase().includes(c.toLowerCase()));
  if (found) return `🕒 *Horarios – ${found}*: ${DB.horarios[found]}\n¿Deseas contacto del tutor o ver requisitos?`;
  const all = centros.map(c => `• *${c}*: ${DB.horarios[c]}`).join("\n");
  return `🕒 *Horarios por Centro*\n${all}\n\nPuedes escribir: *Horarios Centro A*, por ejemplo.`;
}

function replyTutores(text) {
  const centros = Object.keys(DB.tutores);
  const found = centros.find(c => text.toLowerCase().includes(c.toLowerCase()));
  if (found) {
    const t = DB.tutores[found];
    return `👤 *Tutor – ${found}*: ${t.nombre}\n📧 ${t.contacto}\n¿Te comparto también horarios o requisitos?`;
  }
  const all = centros.map(c => `• *${c}*: ${DB.tutores[c].nombre} — ${DB.tutores[c].contacto}`).join("\n");
  return `👤 *Tutores por Centro*\n${all}\n\nPuedes escribir: *Tutor Centro A*, por ejemplo.`;
}

function replyRequisitos() {
  const items = DB.requisitos.map(r => `• ${r}`).join("\n");
  return `📝 *Requisitos para Participar*\n${items}\n\n¿Deseas el *formulario de inscripción* o hablar con un tutor?`;
}

function replyFallback() {
  return "No logré entender del todo tu consulta 🤔\n\nPrueba con *Centros*, *Horarios*, *Tutores* o *Requisitos*, o escribe *menú*.";
}

// ---- Handler Vercel ----
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("OK"); // Telegram solo manda POST

  try {
    const update = req.body;
    const msg = update.message || update.edited_message || update.callback_query?.message;
    if (!msg) return res.status(200).json({ status: "no_message" });

    const chat_id = msg.chat.id;
    const text = update.message?.text || update.edited_message?.text || "";

    const intent = detectIntent(text);

    if (intent === "start") {
      await send(
        chat_id,
        [
          "¡Hola! Soy el asistente virtual de *Misiones Universitarias – UTPL* 🤝",
          "Puedo ayudarte con información del *Voluntariado*.",
        ].join("\n"),
        { reply_markup: mainMenu() }
      );
      return res.status(200).json({ status: "ok" });
    }

    switch (intent) {
      case "centros":
        await send(chat_id, replyCentros(), { reply_markup: mainMenu() });
        break;
      case "horarios":
        await send(chat_id, replyHorarios(text), { reply_markup: mainMenu() });
        break;
      case "tutores":
        await send(chat_id, replyTutores(text), { reply_markup: mainMenu() });
        break;
      case "requisitos":
        await send(chat_id, replyRequisitos(), { reply_markup: mainMenu() });
        break;
      case "menu":
        await send(chat_id, "Aquí tienes las opciones 👇", { reply_markup: mainMenu() });
        break;
      default:
        await send(chat_id, replyFallback(), { reply_markup: mainMenu() });
        break;
    }

    // cierre suave
    await send(
      chat_id,
      "¿Esta información te fue útil? Puedes escribir *menú* para ver opciones o *contacto* para hablar con un tutor."
    );

    if (/contacto|hablar|tutor/i.test(text)) {
      await send(
        chat_id,
        `Puedes escribirnos a: ${DB.contactoDepartamento}\nSi me indicas el *centro*, te paso el contacto del tutor correspondiente.`
      );
    }

    return res.status(200).json({ status: "ok" });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ status: "error_logged" });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};
