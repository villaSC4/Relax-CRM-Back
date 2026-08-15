import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/database';

export interface Client {
  id?: number;
  full_name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
}

export class ClientRepository {
  static async findByPhone(phone: string): Promise<Client | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM clients WHERE phone = ? LIMIT 1',
      [phone]
    );

    if (rows.length === 0) return null;
    return rows[0] as Client;
  }

  static async create(data: { full_name: string; phone: string; email?: string }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO clients (full_name, phone, email) VALUES (?, ?, ?)',
      [data.full_name, data.phone, data.email || null]
    );

    return result.insertId;
  }
}
