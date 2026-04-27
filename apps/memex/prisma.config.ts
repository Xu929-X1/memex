import { defineConfig } from 'prisma/config'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

export default defineConfig({
    schema: './prisma/schema',
    datasource: {
        url: process.env.DIRECT_URL || "",
    }
})