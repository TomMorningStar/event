// Сначала .env.local, затем .env (уже заданные значения не перезаписываются)
import dotenv from 'dotenv'

dotenv.config({ path: ['.env.local', '.env'], quiet: true })
