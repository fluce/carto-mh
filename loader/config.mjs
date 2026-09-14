import 'dotenv/config';
import { resolve } from 'node:path'
export const secret=process.env.MH_USER_SECRET;
export const id=process.env.MH_USER_ID;

export const targetDir=resolve(process.cwd(), 'public');