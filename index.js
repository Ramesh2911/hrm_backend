import express from "express";
import cors from 'cors';
import { AdminRoutes } from "./Routes/AdminRoutes.js";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from 'url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

app.use(cors({
   origin: ["https://radiancehrm.uk"],
   methods: ['GET', 'POST', 'PUT', "DELETE"],
   credentials: true
}));
app.options('*', cors());
app.use(express.json());
app.use(cookieParser());
app.use('/api', AdminRoutes);
app.use(express.static('Public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(PORT, () => {
   console.log(`Server is running on port ${PORT}`);
});
