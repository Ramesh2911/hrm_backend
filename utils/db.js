import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

let con;

try {
   con = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
   });

   console.log("DB_HOST:", process.env.DB_HOST);
   console.log("DB_USER:", process.env.DB_USER);
   console.log("DB_NAME:", process.env.DB_NAME);


   console.log("Database connection pool created successfully");
} catch (error) {
   console.error("Error creating database connection pool:", error);
}

export default con;
