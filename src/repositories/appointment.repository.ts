import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/database';

export interface Appointment {
  id?: number;
  client_id: number;
  service_id: number;
  start_time: Date | string;
  end_time: Date | string;
  status: 'PENDING' | 'CONFIRMED' | 'ATTENDED' | 'CANCELLED';
  price_paid: number;
  google_event_id?: string | null;
  notes?: string | null;
}

export class AppointmentRepository {
  static async create(appointment: Appointment): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO appointments 
      (client_id, service_id, start_time, end_time, status, price_paid, google_event_id, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appointment.client_id,
        appointment.service_id,
        appointment.start_time,
        appointment.end_time,
        appointment.status,
        appointment.price_paid,
        appointment.google_event_id || null,
        appointment.notes || null,
      ]
    );

    return result.insertId;
  }

  static async findAllWithClientDetails(): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        a.id, 
        a.start_time, 
        a.end_time, 
        a.status, 
        a.price_paid,
        c.full_name AS client_name, 
        c.phone AS client_phone, 
        s.name AS service_name,
        s.duration_minutes
      FROM appointments a
      INNER JOIN clients c ON a.client_id = c.id
      INNER JOIN services s ON a.service_id = s.id
      ORDER BY a.start_time DESC`
    );

    return rows;
  }
}
