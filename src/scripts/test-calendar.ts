import { CalendarService } from '../services/calendar.service';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  console.log('🧪 Probando conexión con Google Calendar...');
  console.log('📅 CALENDAR_ID:', process.env.GOOGLE_CALENDAR_ID || 'aaronpalominod34@gmail.com');
  
  try {
    const slots = await CalendarService.getAvailableSlots('2026-08-17', 50);
    console.log(`✅ Consulta exitosa. Se encontraron ${slots.length} cupos para el 2026-08-17:`);
    console.log(slots);
  } catch (error: any) {
    console.error('❌ Error detallado al consultar Google Calendar:');
    console.error(error);
  }
}

test();
