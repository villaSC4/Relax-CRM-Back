import { google } from 'googleapis';
import path from 'path';

const KEYFILEPATH = path.join(__dirname, '../../google-credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

const calendar = google.calendar({ version: 'v3', auth });
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'aaronpalominod34@gmail.com';

export class CalendarService {
  static isWithinWorkingHours(dateInput: Date): boolean {
    const dayOfWeek = dateInput.getDay();
    const hour = dateInput.getHours();

    if (dayOfWeek === 0) return false;

    if (dayOfWeek === 4) {
      return hour >= 9 && hour < 13;
    }

    return hour >= 9 && hour < 17;
  }

  static async createAppointmentEvent(data: {
    clientName: string;
    phone: string;
    serviceName: string;
    durationMinutes: number;
    startTime: Date;
    endTime: Date;
  }): Promise<string | undefined> {
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
    } catch (error) {
      console.error('Error al insertar evento en Google Calendar:', error);
      return undefined;
    }
  }

  static async getAvailableSlots(dateStr: string, durationMinutes: number = 50): Promise<string[]> {
    const targetDate = new Date(`${dateStr}T00:00:00`);
    const dayOfWeek = targetDate.getDay();

    if (dayOfWeek === 0) return [];

    const startHour = 9;
    const endHour = dayOfWeek === 4 ? 13 : 17;

    const timeMin = new Date(`${dateStr}T00:00:00-05:00`).toISOString();
    const timeMax = new Date(`${dateStr}T23:59:59-05:00`).toISOString();

    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const busyEvents = response.data.items || [];
    const durationMs = durationMinutes * 60 * 1000;
    const availableSlots: string[] = [];

    for (let hour = startHour; hour < endHour; hour++) {
      for (const minute of [0, 30]) {
        const slotStart = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00-05:00`);
        const slotEnd = new Date(slotStart.getTime() + durationMs);

        if (slotEnd.getHours() > endHour || (slotEnd.getHours() === endHour && slotEnd.getMinutes() > 0)) continue;

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
