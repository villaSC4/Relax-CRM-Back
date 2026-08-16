import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

const KEYFILEPATH = fs.existsSync(path.resolve(process.cwd(), 'google-credentials.json'))
  ? path.resolve(process.cwd(), 'google-credentials.json')
  : path.resolve(__dirname, '../../google-credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

let auth: any = null;

if (process.env.GOOGLE_CREDENTIALS_JSON) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });
    console.log('✅ Google Calendar Auth cargado desde GOOGLE_CREDENTIALS_JSON.');
  } catch (err: any) {
    console.error('⚠️ Error al parsear GOOGLE_CREDENTIALS_JSON:', err.message);
  }
}

if (!auth && fs.existsSync(KEYFILEPATH)) {
  try {
    auth = new google.auth.GoogleAuth({
      keyFile: KEYFILEPATH,
      scopes: SCOPES,
    });
    console.log('✅ Google Calendar Auth cargado desde archivo local google-credentials.json.');
  } catch (err: any) {
    console.error('⚠️ Error al cargar google-credentials.json:', err.message);
  }
}

const calendar = auth ? google.calendar({ version: 'v3', auth }) : null;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'aaronpalominod34@gmail.com';

export class CalendarService {
  static isWithinWorkingHours(dateInput: Date): boolean {
    if (isNaN(dateInput.getTime())) return false;

    const limaStr = dateInput.toLocaleString('en-US', { timeZone: 'America/Lima' });
    const limaDate = new Date(limaStr);
    const dayOfWeek = limaDate.getDay();
    const hour = limaDate.getHours();

    if (dayOfWeek === 0) return false; // Domingo cerrado

    if (dayOfWeek === 4) {
      return hour >= 9 && hour < 14; // Jueves de 9am a 2pm
    }

    return hour >= 9 && hour < 19; // Lunes a Sábado de 9am a 7pm
  }

  static async createAppointmentEvent(data: {
    clientName: string;
    phone: string;
    serviceName: string;
    durationMinutes: number;
    startTime: Date;
    endTime: Date;
  }): Promise<string | undefined> {
    if (!calendar) {
      console.warn('⚠️ Google Calendar no está autenticado. La cita se guardará en MySQL sin sincronizar con Google.');
      return undefined;
    }

    try {
      const summary = `RELAX Sesión: ${data.clientName}`;
      const description = `
        Cliente: ${data.clientName}
        Teléfono: ${data.phone}
        Servicio: ${data.serviceName}
        Duración: ${data.durationMinutes} min
      `;

      const response = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: {
          summary,
          description,
          start: { dateTime: data.startTime.toISOString(), timeZone: 'America/Lima' },
          end: { dateTime: data.endTime.toISOString(), timeZone: 'America/Lima' },
        },
      });

      return response.data.id || undefined;
    } catch (error: any) {
      console.error('❌ Error al insertar evento en Google Calendar:', error.message || error);
      return undefined;
    }
  }

  static async getAvailableSlots(dateStr: string, durationMinutes: number = 50): Promise<string[]> {
    const targetDate = new Date(`${dateStr}T00:00:00-05:00`);
    const limaDate = new Date(targetDate.toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const dayOfWeek = limaDate.getDay();

    if (dayOfWeek === 0) return []; // Domingo cerrado

    const startHour = 9;
    const endHour = dayOfWeek === 4 ? 14 : 19; // Jueves hasta 14h, otros días hasta 19h

    const timeMin = new Date(`${dateStr}T00:00:00-05:00`).toISOString();
    const timeMax = new Date(`${dateStr}T23:59:59-05:00`).toISOString();

    let busyEvents: any[] = [];

    if (calendar) {
      try {
        const response = await calendar.events.list({
          calendarId: CALENDAR_ID,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
        });
        busyEvents = response.data.items || [];
      } catch (error: any) {
        console.error('⚠️ Google Calendar API error (usando slots por defecto):', error.message || error);
      }
    }

    const durationMs = durationMinutes * 60 * 1000;
    const availableSlots: string[] = [];
    const endLimit = new Date(`${dateStr}T${endHour.toString().padStart(2, '0')}:00:00-05:00`);

    for (let hour = startHour; hour < endHour; hour++) {
      for (const minute of [0, 30]) {
        const slotStartStr = `${dateStr}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00-05:00`;
        const slotStart = new Date(slotStartStr);
        const slotEnd = new Date(slotStart.getTime() + durationMs);

        // No permitir citas que terminen después del cierre
        if (slotEnd.getTime() > endLimit.getTime()) continue;

        const isBusy = busyEvents.some((event) => {
          if (!event.start?.dateTime || !event.end?.dateTime) return false;
          const eventStart = new Date(event.start.dateTime);
          const eventEnd = new Date(event.end.dateTime);
          return slotStart < eventEnd && slotEnd > eventStart;
        });

        if (!isBusy) {
          availableSlots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
        }
      }
    }

    return availableSlots;
  }
}
