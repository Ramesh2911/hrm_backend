import express from "express";
import con from "../utils/db.js";
import jwt from "jsonwebtoken";
import bcrypt from 'bcryptjs';
import multer from "multer";
import nodemailer from 'nodemailer';
import path from "path";
import { fileURLToPath } from 'url';
import fs from 'fs';

const JWT_SECRET_KEY = 'your_jwt_secret_key';
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) {
   fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
   destination: (req, file, cb) => {
      cb(null, uploadDir);
   },
   filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
   },
});

const upload = multer({ storage: storage });

const ADMIN_ID = '1';

const generateEmpId = async () => {
   try {
      const sql = 'SELECT emp_id FROM employee_data ORDER BY id DESC LIMIT 1';
      const [rows] = await con.execute(sql);

      let newEmpId;
      if (rows.length > 0) {
         const lastEmpId = rows[0].emp_id;
         const lastNumber = parseInt(lastEmpId.split('-')[1]);
         newEmpId = `RAD-${lastNumber + 1}`;
      } else {
         newEmpId = 'RAD-1001';
      }

      return newEmpId;
   } catch (error) {
      console.error('Error generating employee ID:', error);
      throw error;
   }
};

const transporter = nodemailer.createTransport({
   service: 'Gmail',
   auth: {
      user: 'janaramesh15@gmail.com',
      pass: 'oglwtaangkovbeqg',
   },
   debug: true,
   logger: true
});

//Authenticate
// router.post('/authenticate', async (req, res) => {
//    const { user_name, user_password } = req.body;

//    if (!user_name || !user_password) {
//       return res.status(400).json({ loginStatus: false, Error: "Username and password are required" });
//    }

//    const sql = 'SELECT * FROM users WHERE username = ?';

//    try {
//       const [result] = await con.query(sql, [user_name]);

//       if (result.length === 0) {
//          return res.status(404).json({ loginStatus: false, Error: "User not found" });
//       }

//       const user = result[0];
//       const match = await bcrypt.compare(user_password, user.password);
//       if (!match) {
//          return res.status(401).json({ loginStatus: false, Error: "Incorrect username or password" });
//       }
//       const expiresIn = 1 * 60 * 60;
//       const token = jwt.sign(
//          { emp_id: user.emp_id, role: user.role_name },
//          JWT_SECRET_KEY,
//          { expiresIn }
//       );
//       const token_expired_on = new Date(Date.now() + expiresIn * 1000).toISOString();
//       const updateTokenSql = 'UPDATE users SET token = ?, updated_at = ? WHERE id = ?';
//       await con.execute(updateTokenSql, [token, new Date(), user.id]);
//       const empSql = "SELECT emp_id, first_name, last_name FROM employee_data WHERE email = ?";
//       const [empResult] = await con.query(empSql, [user.username]);

//       const responseData = {
//          loginStatus: true,
//          userData: {
//             id: user.id,
//             username: user.username,
//             role_id: user.role_id,
//             role_name: user.role_name,
//             token: token,
//             token_expired_on: token_expired_on,
//             is_default_pwd: user.is_default_pwd,
//             message: `${user.role_name} login successful`
//          }
//       };

//       if (empResult.length > 0) {
//          const employee = empResult[0];
//          responseData.userData.emp_id = employee.emp_id;
//          responseData.userData.first_name = employee.first_name;
//          responseData.userData.last_name = employee.last_name;
//       } else {
//          responseData.userData.message += " (No employee data found)";
//       }

//       return res.json(responseData);
//    } catch (error) {
//       console.error("Error during login process:", error);
//       return res.status(500).json({ loginStatus: false, Error: "Internal server error" });
//    }
// });

router.post('/authenticate', async (req, res) => {
   const { user_name, user_password } = req.body;
   if (!user_name || !user_password) {
      return res.status(400).json({
         loginStatus: false,
         Error: "Username and password are required",
      });
   }

   try {
      const sql = 'SELECT * FROM users WHERE username = ?';
      const [result] = await con.query(sql, [user_name]);

      // Check if user exists
      if (result.length === 0) {
         return res.status(404).json({
            loginStatus: false,
            Error: "User not found",
         });
      }

      const user = result[0];
      if (Number(user.status) !== 1) {
         return res.status(403).json({
            loginStatus: false,
            Error:
               Number(user.status === 2)
                  ? "Access denied. Job Left"
                  : Number(user.status === 3)
                     ? "Access denied. Suspended"
                     : Number(user.status === 4)
                        ? "Access denied. Terminated"
                        : "Access denied. Unknown status",
         });
      }

      const match = await bcrypt.compare(user_password, user.password);
      if (!match) {
         return res.status(401).json({
            loginStatus: false,
            Error: "Incorrect username or password",
         });
      }

      const expiresIn = 1 * 60 * 60;
      const token = jwt.sign(
         { emp_id: user.emp_id, role: user.role_name },
         JWT_SECRET_KEY,
         { expiresIn }
      );
      const token_expired_on = new Date(Date.now() + expiresIn * 1000).toISOString();

      const updateTokenSql = 'UPDATE users SET token = ?, updated_at = ? WHERE id = ?';
      await con.execute(updateTokenSql, [token, new Date(), user.id]);

      const empSql = "SELECT emp_id, first_name, last_name FROM employee_data WHERE email = ?";
      const [empResult] = await con.query(empSql, [user.username]);

      const responseData = {
         loginStatus: true,
         userData: {
            id: user.id,
            username: user.username,
            role_id: user.role_id,
            role_name: user.role_name,
            token: token,
            token_expired_on: token_expired_on,
            is_default_pwd: user.is_default_pwd,
            message: `${user.role_name} login successful`,
         },
      };

      if (empResult.length > 0) {
         const employee = empResult[0];
         responseData.userData.emp_id = employee.emp_id;
         responseData.userData.first_name = employee.first_name;
         responseData.userData.last_name = employee.last_name;
      }

      return res.json(responseData);
   } catch (error) {
      console.error("Error during login process:", error.message);
      return res.status(500).json({
         loginStatus: false,
         Error: "Internal server error",
      });
   }
});

//change password
router.post('/change-password', async (req, res) => {
   const { username, old_password, new_password } = req.body;

   if (!username || !old_password || !new_password) {
      return res.status(400).json({ message: 'All fields are required.' });
   }

   try {
      const [rows] = await con.query('SELECT * FROM users WHERE username = ?', [username]);

      if (rows.length === 0) {
         return res.status(404).json({ message: 'User not found.' });
      }

      const user = rows[0];

      const isMatch = await bcrypt.compare(old_password, user.password);
      if (!isMatch) {
         return res.status(401).json({ message: 'Old password is incorrect.' });
      }

      const hashedPassword = await bcrypt.hash(new_password, 10);

      await con.query('UPDATE users SET password = ?, is_default_pwd = ? WHERE username = ?', [hashedPassword, 1, username]);

      res.status(200).json({ message: 'Password changed successfully.' });
   } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error.' });
   }
});

// forgot password
router.post('/forgot-password', async (req, res) => {
   const { user_name } = req.body;

   if (!user_name) {
      return res.status(400).json({ message: 'Username is required' });
   }

   try {
      const [user] = await con.execute('SELECT * FROM users WHERE username = ?', [user_name]);
      if (user.length === 0) {
         return res.status(200).json({ message: ' A reset link has been sent' });
      }

      const token = jwt.sign({ id: user[0].id }, JWT_SECRET_KEY, { expiresIn: '1h' });
      const resetLink = `https://radiancehrm.uk/reset-password/${token}`;

      const mailOptions = {
         from: 'janaramesh15@gmail.com',
         to: user[0].username,
         subject: 'Password Reset Request',
         html: `<p>Click the link below to reset your password. The link is valid for 1 hour:</p>
                  <a href="${resetLink}">${resetLink}</a>`
      };

      await transporter.sendMail(mailOptions);

      res.status(200).json({ message: 'A reset link has been sent' });
   } catch (error) {
      console.error('Error in forgot-password:', error);
      res.status(500).json({ message: 'An error occurred, please try again later' });
   }
});

router.post('/reset-password', async (req, res) => {
   const { token, password } = req.body;

   try {
     const decoded = jwt.verify(token, JWT_SECRET_KEY);

     if (!decoded) {
       return res.status(400).json({ message: 'Invalid or expired token' });
     }

     const hashedPassword = await bcrypt.hash(password, 10);

     const [result] = await con.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, decoded.id]);

     if (result.affectedRows > 0) {
       res.status(200).json({ message: 'Password reset successful' });
     } else {
       res.status(400).json({ message: 'Failed to reset password' });
     }
   } catch (error) {
     console.error('Error resetting password:', error);
     res.status(500).json({ message: 'An error occurred, please try again later' });
   }
 });

//Add Department
router.post('/add-department', async (req, res) => {
   const { department_name, department_functionality } = req.body;
   if (!department_name || !department_functionality) {
      return res.status(400).json({ error: 'All fields are required' });
   }

   try {
      const sql = 'INSERT INTO departments (department_name, department_functionality) VALUES (?, ?)';
      const values = [department_name, department_functionality];

      const [result] = await con.query(sql, values);

      res.status(200).json({ message: 'Department added successfully', id: result.insertId });
   } catch (err) {
      console.error('Error adding department:', err);
      res.status(500).json({ error: 'Database insertion failed' });
   }
});

//List Department
router.get('/departments', async (req, res) => {
   const sql = 'SELECT id, department_name, department_functionality, created_at FROM departments';

   try {
      const [results] = await con.query(sql);
      if (results.length > 0) {
         res.status(200).json({
            message: 'Departments fetched successfully.',
            data: results
         });
      } else {
         res.status(200).json({
            message: 'No departments found.',
            data: []
         });
      }
   } catch (err) {
      console.error("Error executing query:", err);
      res.status(500).json({ error: "Database query error" });
   }
});

//Update Department
router.put('/update-department', async (req, res) => {
   const { id, department_name, department_functionality } = req.body;
   if (!id || !department_name || !department_functionality) {
      return res.status(400).json({ error: 'All fields are required' });
   }

   try {
      const sql = 'UPDATE departments SET department_name = ?, department_functionality = ?, updated_at = NOW() WHERE id = ?';
      const values = [department_name, department_functionality, id];

      const [result] = await con.query(sql, values);
      if (result.affectedRows === 0) {
         return res.status(404).json({ error: 'Department not found' });
      }

      res.status(200).json({ message: 'Department updated successfully' });
   } catch (err) {
      console.error('Error updating department:', err);
      res.status(500).json({ error: 'Database update failed' });
   }
});

//Delete Department
router.delete('/delete/department/:id', async (req, res) => {
   try {
      const { id } = req.params;
      const result = await con.query('DELETE FROM departments WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
         return res.status(404).json({ message: 'department not found.' });
      }

      res.status(200).json({ message: 'Department deleted successfully.' });
   } catch (error) {
      console.error('Error deleting department:', error);
      res.status(500).json({ error: 'Failed to delete department.' });
   }
});

//Add Designation
router.post('/add-designation', async (req, res) => {
   const { designation_name, department } = req.body;
   if (!designation_name || !department) {
      return res.status(400).json({ error: 'All fields are required' });
   }

   try {
      const query = 'INSERT INTO designation (designation_name, department) VALUES (?, ?)';
      const [result] = await con.query(query, [designation_name, department]);

      res.status(200).json({ message: 'Designation saved successfully', id: result.insertId });
   } catch (err) {
      console.error('Error saving designation:', err);
      res.status(500).json({ error: 'Failed to save designation' });
   }
});

//List Designation
router.get('/designation', async (req, res) => {
   const sql = 'SELECT id, designation_name, department, created_at FROM designation';

   try {
      const [results] = await con.query(sql);
      if (results.length > 0) {
         res.status(200).json({
            message: 'Designation fetched successfully.',
            data: results
         });
      } else {
         res.status(200).json({
            message: 'No designation found.',
            data: []
         });
      }
   } catch (err) {
      console.error('Error fetching designation data:', err);
      return res.status(500).json({ error: 'An error occurred while fetching designation data.' });
   }
});

//Update Designation
router.put('/update-designation', async (req, res) => {
   const { id, designation_name, department } = req.body;
   if (!id || !designation_name || !department) {
      return res.status(400).json({ error: 'All fields are required' });
   }

   try {
      const sql = 'UPDATE designation SET designation_name = ?, department = ?, updated_at = NOW() WHERE id = ?';
      const values = [designation_name, department, id];

      const [result] = await con.query(sql, values);

      if (result.affectedRows === 0) {
         return res.status(404).json({ error: 'Designation not found' });
      }

      res.status(200).json({ message: 'Designation updated successfully' });
   } catch (err) {
      console.error('Error updating designation:', err);
      res.status(500).json({ error: 'Database update failed' });
   }
});

//Delete designation
router.delete('/delete/designation/:id', async (req, res) => {
   try {
      const { id } = req.params;
      const result = await con.query('DELETE FROM designation WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
         return res.status(404).json({ message: 'Designation not found.' });
      }

      res.status(200).json({ message: 'Designation deleted successfully.' });
   } catch (error) {
      console.error('Error deleting designation:', error);
      res.status(500).json({ error: 'Failed to delete designation.' });
   }
});

//Add Emp
router.post('/add-employee', upload.fields([
   { name: 'emp_pic', maxCount: 1 },
   { name: 'passport_doc', maxCount: 1 },
   { name: 'visa_doc', maxCount: 1 },
   { name: 'address_doc', maxCount: 1 },
   { name: 'p45_doc', maxCount: 1 },
   { name: 'others_doc', maxCount: 1 },
   { name: 'work_check', maxCount: 1 }
]), async (req, res) => {
   const initialValues = {
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      dob: req.body.dob,
      phone: req.body.phone,
      alternate_phone: req.body.alternate_phone,
      email: req.body.email,
      address1: req.body.address1,
      address2: req.body.address2,
      city: req.body.city,
      post_code: req.body.post_code,
      gender: req.body.gender,
      nationality: req.body.nationality,
      passport_no: req.body.passport_no,
      passport_issue_date: req.body.passport_issue_date,
      passport_expiry_date: req.body.passport_expiry_date,
      passport_doc: req.files.passport_doc ? req.files.passport_doc[0].filename : null,
      visa_no: req.body.visa_no,
      visa_issue_date: req.body.visa_issue_date,
      visa_expiry_date: req.body.visa_expiry_date,
      visa_doc: req.files.visa_doc ? req.files.visa_doc[0].filename : null,
      emp_position: req.body.emp_position,
      emp_department: req.body.emp_department,
      salary: req.body.salary,
      joining_date: req.body.joining_date,
      emp_pic: req.files.emp_pic ? req.files.emp_pic[0].filename : null,
      address_doc: req.files.address_doc ? req.files.address_doc[0].filename : null,
      p45_doc: req.files.p45_doc ? req.files.p45_doc[0].filename : null,
      others_doc: req.files.others_doc ? req.files.others_doc[0].filename : null,
      status: req.body.status || "1",
      ni_number: req.body.ni_number,
      contracted_hours: req.body.contracted_hours,
      fulltime_hours: req.body.fulltime_hours,
      holiday: req.body.holiday,
      salary_option: req.body.salary_option,
      probation_period: req.body.probation_period,
      account_name: req.body.account_name,
      account_number: req.body.account_number,
      bank_name: req.body.bank_name,
      sc_number: req.body.sc_number,
      notice_period: req.body.notice_period,
      work_check: req.files.work_check ? req.files.work_check[0].filename : null
   };

   try {
      const defaultPassword = 'RAD@123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      const emp_id = await generateEmpId();

      const checkUserSql = 'SELECT * FROM users WHERE username = ?';
      const [checkResult] = await con.execute(checkUserSql, [initialValues.email]);

      if (checkResult.length > 0) {
         return res.status(400).json({ error: 'Username already exists. Please use a different email.' });
      }

      const employeeData = { ...initialValues, emp_id, password: hashedPassword };
      const employeeInsertFields = Object.keys(employeeData).join(', ');
      const employeePlaceholders = Object.keys(employeeData).map(() => '?').join(', ');
      const employeeValues = Object.values(employeeData);

      const employeeSql = `INSERT INTO employee_data (${employeeInsertFields}) VALUES (${employeePlaceholders})`;
      const [result] = await con.execute(employeeSql, employeeValues);

      const userData = {
         username: initialValues.email,
         password: hashedPassword,
         role_id: 2,
         role_name: 'EMPLOYEE',
         status: 1,
         created_at: new Date(),
         updated_at: new Date()
      };

      const userInsertFields = Object.keys(userData).join(', ');
      const userPlaceholders = Object.keys(userData).map(() => '?').join(', ');
      const userValues = Object.values(userData);

      const userSql = `INSERT INTO users (${userInsertFields}) VALUES (${userPlaceholders})`;
      const [userResult] = await con.execute(userSql, userValues);

      const leaveData = {
         emp_id: emp_id,
         first_name: initialValues.first_name,
         last_name: initialValues.last_name,
         total_leaves: initialValues.holiday
      };

      const leaveInsertFields = Object.keys(leaveData).join(', ');
      const leavePlaceholders = Object.keys(leaveData).map(() => '?').join(', ');
      const leaveValues = Object.values(leaveData);

      const leaveSql = `INSERT INTO leaves (${leaveInsertFields}) VALUES (${leavePlaceholders})`;
      await con.execute(leaveSql, leaveValues);

      const mailOptions = {
         from: 'janaramesh15@gmail.com',
         to: initialValues.email,
         subject: 'Welcome to Radiance IT',
         text: `Dear ${initialValues.first_name},\n\nWe are pleased to inform you that your employee account with Radiance IT has been successfully created.\n\nLogin URL:https://radiancehrm.uk/\nUsername: ${initialValues.email}\nPassword: ${defaultPassword}\n\nFor security reasons, please change your password immediately after logging in.\n\nIf you have any questions or need assistance, feel free to reach out to our support team.\n\nBest regards,\nRadiance IT Team`
      };

      transporter.sendMail(mailOptions, (mailErr) => {
         if (mailErr) {
            console.error('Error sending email:', mailErr);
            return res.status(500).json({ error: 'Error sending email' });
         }

         res.status(200).json({
            emp_id,
            id: result.insertId,
            user_id: userResult.insertId,
            message: 'Employee added successfully, credentials sent via email'
         });
      });

   } catch (error) {
      console.error('Error generating emp_id or hashing password:', error);
      res.status(500).json({ error: 'Error generating employee ID or hashing password' });
   }
});

//List Emp
router.get('/employees', async (req, res) => {
   const query = `
      SELECT
         e.id,
         e.first_name,
         e.last_name,
         e.email,
         e.emp_id,
         e.nationality,
         e.phone,
         e.dob,
         e.joining_date,
         e.emp_department,
         e.passport_expiry_date,
         e.visa_expiry_date,
         e.emp_position,
         e.created_at,
         u.status
      FROM
         employee_data e
      LEFT JOIN
         users u
      ON
         e.email = u.username`;

   try {
      const [results] = await con.query(query);

      const statusMapping = {
         1: 'Active',
         2: 'Job left',
         3: 'Suspended',
         4: 'Terminated',
      };

      const formattedResults = results.map(employee => ({
         ...employee,
         status: statusMapping[employee.status] || 'Unknown',
      }));

      if (formattedResults.length > 0) {
         res.status(200).json({
            message: 'Employees fetched successfully.',
            data: formattedResults
         });
      } else {
         res.status(200).json({
            message: 'No Employees found.',
            data: []
         });
      }
   } catch (err) {
      console.error('Error fetching data:', err);
      return res.status(500).json({ error: 'An error occurred while fetching data.' });
   }
});

//View Emp
router.get('/employee/view/:emp_id', async (req, res) => {
   const emp_id = req.params.emp_id;

   try {
      const query = `
         SELECT emp_id, first_name, last_name, dob, phone, alternate_phone, email,
                address1, address2, city, post_code, gender, nationality, passport_no,
                passport_issue_date, passport_expiry_date, visa_no, visa_issue_date,
                visa_expiry_date, emp_position, emp_department, salary, joining_date,
                emp_pic, address_doc, p45_doc, others_doc, status, ni_number,
                contracted_hours, fulltime_hours, holiday, salary_option,
                probation_period, account_name, account_number, bank_name,
                sc_number, notice_period, work_check,passport_doc,visa_doc
         FROM employee_data
         WHERE emp_id = ?`;

      const [result] = await con.query(query, [emp_id]);
      if (result.length > 0) {
         res.status(200).json({
            success: true,
            message: 'Employee details fetched successfully',
            data: result
         });
      } else {
         res.status(200).json({
            success: false,
            message: 'Employee not found.',
            data: []
         });
      }
   } catch (error) {
      console.error('Error fetching employee details:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch employee details' });
   }
});

//Update Emp
router.put('/update-employee/:emp_id', upload.fields([
   { name: 'emp_pic', maxCount: 1 },
   { name: 'passport_doc', maxCount: 1 },
   { name: 'visa_doc', maxCount: 1 },
   { name: 'address_doc', maxCount: 1 },
   { name: 'p45_doc', maxCount: 1 },
   { name: 'others_doc', maxCount: 1 },
   { name: 'work_check', maxCount: 1 }
]), async (req, res) => {
   const emp_id = req.params.emp_id;
   const updatedValues = {
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      dob: req.body.dob,
      phone: req.body.phone,
      alternate_phone: req.body.alternate_phone,
      email: req.body.email,
      address1: req.body.address1,
      address2: req.body.address2,
      city: req.body.city,
      post_code: req.body.post_code,
      gender: req.body.gender,
      nationality: req.body.nationality,
      passport_no: req.body.passport_no,
      passport_issue_date: req.body.passport_issue_date,
      passport_expiry_date: req.body.passport_expiry_date,
      passport_doc: req.files.passport_doc ? req.files.passport_doc[0].filename : undefined,
      visa_no: req.body.visa_no,
      visa_issue_date: req.body.visa_issue_date,
      visa_expiry_date: req.body.visa_expiry_date,
      visa_doc: req.files.visa_doc ? req.files.visa_doc[0].filename : undefined,
      emp_position: req.body.emp_position,
      emp_department: req.body.emp_department,
      salary: req.body.salary,
      joining_date: req.body.joining_date,
      emp_pic: req.files.emp_pic ? req.files.emp_pic[0].filename : undefined,
      address_doc: req.files.address_doc ? req.files.address_doc[0].filename : undefined,
      p45_doc: req.files.p45_doc ? req.files.p45_doc[0].filename : undefined,
      others_doc: req.files.others_doc ? req.files.others_doc[0].filename : undefined,
      status: req.body.status,
      ni_number: req.body.ni_number,
      contracted_hours: req.body.contracted_hours,
      fulltime_hours: req.body.fulltime_hours,
      holiday: req.body.holiday,
      salary_option: req.body.salary_option,
      probation_period: req.body.probation_period,
      account_name: req.body.account_name,
      account_number: req.body.account_number,
      bank_name: req.body.bank_name,
      sc_number: req.body.sc_number,
      notice_period: req.body.notice_period,
      work_check: req.files.work_check ? req.files.work_check[0].filename : undefined
   };

   try {
      const filteredValues = Object.fromEntries(
         Object.entries(updatedValues).filter(([_, v]) => v !== undefined)
      );

      const updateFields = Object.keys(filteredValues)
         .map(field => `${field} = ?`)
         .join(', ');
      const updateValues = Object.values(filteredValues);

      const updateSql = `UPDATE employee_data SET ${updateFields} WHERE emp_id = ?`;
      await con.execute(updateSql, [...updateValues, emp_id]);

      if (req.body.status || req.body.email) {
         const selectEmailSql = `SELECT email FROM employee_data WHERE emp_id = ?`;
         const [rows] = await con.execute(selectEmailSql, [emp_id]);

         if (rows.length > 0) {
            const employeeEmail = rows[0].email;

            if (req.body.status) {
               const updateUserStatusSql = `UPDATE users SET status = ? WHERE username = ?`;
               await con.execute(updateUserStatusSql, [req.body.status, employeeEmail]);
            }

            if (req.body.email) {
               const updateUserEmailSql = `UPDATE users SET username = ? WHERE username = ?`;
               await con.execute(updateUserEmailSql, [req.body.email, employeeEmail]);
            }
         }
      }

      res.status(200).json({ message: 'Employee updated successfully.' });

   } catch (error) {
      console.error('Error updating employee:', error);
      res.status(500).json({ error: 'Error updating employee data' });
   }
});

//Delete Emp
// router.delete('/delete/employee/:email', async (req, res) => {
//    const { email } = req.params;

//    const connection = await con.getConnection();
//    try {
//       await connection.beginTransaction();

//       const [empResult] = await connection.execute(
//          'DELETE FROM employee_data WHERE email = ?',
//          [email]
//       );

//       if (empResult.affectedRows === 0) {
//          await connection.rollback();
//          return res.status(404).json({ message: 'Employee not found.' });
//       }
//       const [userResult] = await connection.execute(
//          'DELETE FROM users WHERE username = ?',
//          [email]
//       );
//       await connection.commit();

//       res.status(200).json({
//          message: 'Employee deleted successfully from both tables.',
//          deletedFromEmployeeData: empResult.affectedRows,
//          deletedFromUsers: userResult.affectedRows
//       });
//    } catch (error) {
//       await connection.rollback();
//       console.error('Error deleting employee:', error);
//       res.status(500).json({ message: 'Internal server error.' });
//    } finally {
//       connection.release();
//    }
// });

router.delete('/delete/employee/:email', async (req, res) => {
   const { email } = req.params;

   let connection;
   try {
      connection = await con.getConnection();

      await connection.beginTransaction();

      const [empDataResult] = await connection.execute(
         'SELECT emp_id FROM employee_data WHERE email = ?',
         [email]
      );

      if (empDataResult.length === 0) {
         await connection.rollback();
         return res.status(404).json({ message: 'Employee not found.' });
      }

      const empId = empDataResult[0].emp_id;

      const [empResult] = await connection.execute(
         'DELETE FROM employee_data WHERE email = ?',
         [email]
      );

      const [userResult] = await connection.execute(
         'DELETE FROM users WHERE username = ?',
         [email]
      );
      const [attendanceResult] = await connection.execute(
         'DELETE FROM attendance WHERE emp_id = ?',
         [empId]
      );

      const [documentsResult] = await connection.execute(
         'DELETE FROM documents WHERE sender = ? OR receiver = ?',
         [empId, empId]
      );

      const [leavesResult] = await connection.execute(
         'DELETE FROM leaves WHERE emp_id = ?',
         [empId]
      );

      const [leavesAppResult] = await connection.execute(
         'DELETE FROM leaves_application WHERE emp_id = ?',
         [empId]
      );

      const [p60Result] = await connection.execute(
         'DELETE FROM p60 WHERE receiver = ?',
         [empId]
      );

      const [paySlipsResult] = await connection.execute(
         'DELETE FROM pay_slips WHERE receiver = ?',
         [empId]
      );

      const [projectsResult] = await connection.execute(
         'DELETE FROM projects WHERE project_assign_to = ?',
         [empId]
      );

      await connection.commit();

      res.status(200).json({
         message: 'Employee and related data deleted successfully.',
         deletedFromEmployeeData: empResult.affectedRows,
         deletedFromUsers: userResult.affectedRows,
         deletedFromAttendance: attendanceResult.affectedRows,
         deletedFromDocuments: documentsResult.affectedRows,
         deletedFromLeaves: leavesResult.affectedRows,
         deletedFromLeavesApplication: leavesAppResult.affectedRows,
         deletedFromP60: p60Result.affectedRows,
         deletedFromPaySlips: paySlipsResult.affectedRows,
         deletedFromProjects: projectsResult.affectedRows,
      });
   } catch (error) {
      if (connection) {
         await connection.rollback();
      }
      console.error('Error deleting employee:', error);
      res.status(500).json({ message: 'Internal server error.' });
   } finally {
      if (connection) {
         connection.release();
      }
   }
});

//Add Project
router.post('/add-project', async (req, res) => {
   const { project_title, project_description, project_start_date, project_end_date, project_assign_to } = req.body;

   if (!project_title || !project_description || !project_start_date || !project_assign_to) {
      return res.status(400).json({ error: 'All fields are required' });
   }

   try {
      const sqlInsertProject = `
           INSERT INTO projects
           (project_title, project_description, project_start_date, project_end_date, project_assign_to)
           VALUES (?, ?, ?, ?, ?)`;
      const projectValues = [project_title, project_description, project_start_date, project_end_date, project_assign_to];
      const [projectResults] = await con.query(sqlInsertProject, projectValues);

      const projectId = projectResults.insertId;
      const sqlUpdateEmployee = 'UPDATE employee_data SET assigned_project = ? WHERE emp_id = ?';
      const [updateResults] = await con.query(sqlUpdateEmployee, [projectId, project_assign_to]);

      if (updateResults.affectedRows === 0) {
         return res.status(404).json({ error: 'Employee not found' });
      }
      res.status(200).json({
         message: 'Project created successfully',
         projectId: projectId
      });
   } catch (error) {
      console.error('Error adding project:', error);
      res.status(500).json({ error: 'Database operation failed' });
   }
});

//List Project
router.get('/projects', async (req, res) => {
   const sql = 'SELECT id, project_title, project_description, project_start_date, project_end_date, project_assign_to, created_at FROM projects';

   try {
      const [results] = await con.query(sql);
      if (results.length > 0) {
         res.status(200).json({
            message: 'Project fetched successfully.',
            data: results
         });
      } else {
         res.status(200).json({
            message: 'No project found.',
            data: []
         });
      }
   } catch (err) {
      console.error('Error fetching projects:', err);
      return res.status(500).json({ error: 'An error occurred while fetching projects.' });
   }
});

//Update Project
router.put('/update-project', async (req, res) => {
   const { id, project_title, project_description, project_start_date, project_end_date, project_assign_to } = req.body;
   if (!id || !project_title || !project_description || !project_start_date || !project_end_date || !project_assign_to) {
      return res.status(400).json({ error: 'All fields are required' });
   }

   try {
      const sqlProject = `
           UPDATE projects
           SET project_title = ?, project_description = ?, project_start_date = ?,
               project_end_date = ?, project_assign_to = ?, updated_at = NOW()
           WHERE id = ?`;
      const projectValues = [project_title, project_description, project_start_date, project_end_date, project_assign_to, id];
      const [projectResult] = await con.query(sqlProject, projectValues);

      if (projectResult.affectedRows === 0) {
         return res.status(404).json({ error: 'Project not found' });
      }
      const sqlEmployee = 'UPDATE employee_data SET assigned_project = ? WHERE emp_id = ?';
      const employeeValues = [id, project_assign_to];
      const [employeeResult] = await con.query(sqlEmployee, employeeValues);

      if (employeeResult.affectedRows === 0) {
         return res.status(404).json({ error: 'Employee not found' });
      }

      res.status(200).json({ message: 'Project updated successfully' });
   } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Database update failed' });
   }
});

//Delete Project
router.delete('/delete/project/:id', async (req, res) => {
   try {
      const { id } = req.params;
      const result = await con.query('DELETE FROM projects WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
         return res.status(404).json({ message: 'project not found.' });
      }

      res.status(200).json({ message: 'Project deleted successfully.' });
   } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Failed to delete project.' });
   }
});

// Add Attendance
router.post('/add-attendance', async (req, res) => {
   const { emp_id, first_name, last_name, attendance_date, attendance_login_time, attendance_logout_time } = req.body;

   if (!emp_id || !first_name || !last_name || !attendance_date) {
      return res.status(400).json({ error: 'emp_id, first_name, last_name, and attendance_date are required' });
   }

   try {
      const checkSql = `SELECT id FROM attendance WHERE emp_id = ? AND attendance_date = ?`;
      const [existingRecord] = await con.query(checkSql, [emp_id, attendance_date]);

      if (!existingRecord.length) {
         const insertSql = `
            INSERT INTO attendance (emp_id, first_name, last_name, attendance_date, attendance_login_time,attendance_logout_time)
            VALUES (?, ?, ?, ?, ?,?)`;
         const [result] = await con.query(insertSql, [emp_id, first_name, last_name, attendance_date, attendance_login_time, attendance_logout_time]);

         return res.status(200).json({ message: 'Attendance saved successfully', id: result.insertId });
      }
      // else {
      //    if (!attendance_logout_time) {
      //       return res.status(400).json({ error: 'Logout time is required for updating attendance' });
      //    }

      //    const updateSql = `
      //       UPDATE attendance
      //       SET attendance_logout_time = ?
      //       WHERE id = ?`;
      //    await con.query(updateSql, [attendance_logout_time, existingRecord[0].id]);

      //    return res.status(200).json({ message: 'Attendance logout time updated successfully', id: existingRecord[0].id });
      // }
   } catch (err) {
      console.error('Error handling attendance:', err);
      res.status(500).json({ error: 'Database operation failed' });
   }
});

//List Attendance
router.get('/attendance/:emp_id', async (req, res) => {
   const emp_id = req.params.emp_id;

   const sql = 'SELECT * FROM attendance WHERE emp_id = ?';
   try {
      const [results] = await con.query(sql, [emp_id]);
      if (results.length > 0) {
         res.status(200).json({
            message: 'Attendance fetched successfully.',
            data: results
         });
      } else {
         res.status(200).json({
            message: 'No Attendance found.',
            data: []
         });
      }
   } catch (err) {
      console.error('Database query error:', err.message);
      return res.status(500).json({ error: 'Database error', details: err.message });
   }
});

//Update Attendance
router.put('/update-attendance', async (req, res) => {
   const { id, attendance_date, attendance_login_time, attendance_logout_time } = req.body;
   if (!id || !attendance_date || !attendance_login_time || !attendance_logout_time) {
      return res.status(400).json({ error: 'All fields are required' });
   }

   try {
      const sql = `
           UPDATE attendance
           SET attendance_date = ?, attendance_login_time = ?, attendance_logout_time = ?, updated_at = NOW()
           WHERE id = ?
       `;
      const values = [attendance_date, attendance_login_time, attendance_logout_time, id];
      const [result] = await con.query(sql, values);
      if (result.affectedRows === 0) {
         return res.status(404).json({ error: 'Attendance record not found' });
      }

      res.status(200).json({ message: 'Attendance updated successfully' });
   } catch (error) {
      console.error('Error updating attendance:', error);
      res.status(500).json({ error: 'Database update failed' });
   }
});

//Filter Attendance Emp
router.get('/filter-attendance', (req, res) => {
   const { emp_id, year, month } = req.query;

   if (!emp_id || !year || !month) {
      return res.status(400).json({ error: 'Employee ID, Year, and Month are required' });
   }
   const sql = `
      SELECT id, emp_id, attendance_date, attendance_login_time, attendance_logout_time
      FROM attendance
      WHERE emp_id = ?
      AND YEAR(attendance_date) = ?
      AND MONTH(attendance_date) = ?`;

   const values = [emp_id, year, month];

   con.query(sql, values, (err, results) => {
      if (err) {
         return res.status(500).json({ error: 'Database query failed' });
      }
      if (results.length === 0) {
         return res.status(404).json({ message: 'No attendance records found' });
      }
      res.status(200).json({
         message: 'Attendance records retrieved successfully',
         data: results
      });
   });
});

//Admin Other
router.post('/fetch-attendance', async (req, res) => {
   const { emp_id, year, month } = req.body;
   if (!emp_id || !year || !month) {
      return res.status(400).json({ error: 'All fields are required' });
   }

   try {
      const query = `
           SELECT id, emp_id, first_name, last_name, attendance_date, attendance_login_time, attendance_logout_time
           FROM attendance
           WHERE emp_id = ?
           AND YEAR(attendance_date) = ?
           AND MONTH(attendance_date) = ?
       `;

      const [results] = await con.query(query, [emp_id, year, month]);
      if (results.length > 0) {
         res.json({
            message: 'Attendance data found',
            data: results,
         });
      } else {
         res.json({
            message: 'Attendance data not found',
            data: [],
         });
      }
   } catch (error) {
      console.error('Error fetching attendance:', error);
      res.status(500).json({ error: 'Database query failed' });
   }
});

//Leaves
// router.post('/add-leaves', async (req, res) => {
//    const { emp_id, from_date, to_date, duration, description, first_name, last_name } = req.body;

//    const todayDate = new Date().toISOString().slice(0, 10);

//    try {
//       const leaveQuery = 'SELECT total_leaves FROM leaves WHERE emp_id = ?';
//       const [leaveResult] = await con.query(leaveQuery, [emp_id]);

//       if (leaveResult.length > 0) {
//          let total_leaves = leaveResult[0].total_leaves;
//          if (total_leaves < duration) {
//             return res.status(400).json({ message: 'Not enough leaves available.' });
//          }

//          const updatedLeaves = total_leaves - duration;
//          const updateLeavesQuery = 'UPDATE leaves SET total_leaves = ? WHERE emp_id = ?';
//          await con.query(updateLeavesQuery, [updatedLeaves, emp_id]);

//          const leaveApplicationQuery = `
//                INSERT INTO leaves_application
//                (emp_id, from_date, to_date, holiday_taken, holiday_remaining, duration, description, status)
//                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

//          await con.query(leaveApplicationQuery, [
//             emp_id,
//             from_date,
//             to_date,
//             duration,
//             updatedLeaves,
//             duration,
//             description,
//             1
//          ]);

//          const notificationMessage = `${first_name} ${last_name} has requested leave.`;
//          const notificationQuery = `
//                INSERT INTO notification
//                (sender, receiver, message, date)
//                VALUES (?, ?, ?, ?)`;

//          await con.query(notificationQuery, [
//             emp_id,
//             1,
//             notificationMessage,
//             todayDate
//          ]);

//          res.status(200).json({ message: 'Leave request successfully submitted.' });
//       } else {
//          res.status(404).json({ message: 'Employee not found.' });
//       }
//    } catch (error) {
//       console.error('Error occurred while processing the leave request:', error);
//       res.status(500).json({ error: 'An error occurred while processing the leave request.' });
//    }
// });

router.post('/add-leaves', async (req, res) => {
   const { emp_id, from_date, to_date, duration, description, first_name, last_name } = req.body;

   const todayDate = new Date().toISOString().slice(0, 10);

   try {
      const leaveQuery = 'SELECT total_leaves FROM leaves WHERE emp_id = ?';
      const [leaveResult] = await con.query(leaveQuery, [emp_id]);

      if (leaveResult.length > 0) {
         let total_leaves = leaveResult[0].total_leaves;

         // No deduction or addition of leaves taken
         const leaveApplicationQuery = `
               INSERT INTO leaves_application
               (emp_id, from_date, to_date, holiday_taken, holiday_remaining, duration, description, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

         await con.query(leaveApplicationQuery, [
            emp_id,
            from_date,
            to_date,
            0,  // "holiday_taken" is set to 0 since no leave is deducted at this point
            total_leaves,  // "holiday_remaining" remains as it was
            duration,  // "duration" remains the same
            description,
            1  // status set as "requested" or "pending"
         ]);

         const notificationMessage = `${first_name} ${last_name} has requested leave.`;
         const notificationQuery = `
               INSERT INTO notification
               (sender, receiver, message, date)
               VALUES (?, ?, ?, ?)`;

         await con.query(notificationQuery, [
            emp_id,
            1,  // Assuming the receiver is admin (emp_id = 1)
            notificationMessage,
            todayDate
         ]);

         res.status(200).json({ message: 'Leave request successfully submitted.' });
      } else {
         res.status(404).json({ message: 'Employee not found.' });
      }
   } catch (error) {
      console.error('Error occurred while processing the leave request:', error);
      res.status(500).json({ error: 'An error occurred while processing the leave request.' });
   }
});

//Taken leaves count
router.get('/taken-leaves-count/:emp_id', async (req, res) => {
   const emp_id = req.params.emp_id;

   const query = `
       SELECT COALESCE(SUM(CAST(holiday_taken AS DECIMAL(10,2))), 0) AS total_leaves_taken
       FROM leaves_application
       WHERE emp_id = ?
   `;

   try {
      const [result] = await con.query(query, [emp_id]);
      const totalLeavesTaken = result[0]?.total_leaves_taken || 0;

      if (result.length > 0) {
         res.status(200).json({
            success: true,
            message: 'Leaves data retrieved successfully.',
            data: totalLeavesTaken
         });
      } else {
         res.status(200).json({
            success: true,
            message: 'No leaves data found for this employee.',
            data: []
         });
      }
   } catch (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
   }
});

//Remaning leaves count
router.get('/remaining-leaves-count/:emp_id', async (req, res) => {
   const emp_id = req.params.emp_id;

   const query = `
       SELECT total_leaves
       FROM leaves
       WHERE emp_id = ?
       ORDER BY created_at DESC
       LIMIT 1
   `;

   try {
      const [result] = await con.query(query, [emp_id]);

      if (result.length > 0) {
         res.status(200).json({
            success: true,
            message: 'Leaves data retrieved successfully.',
            data: result[0]
         });
      } else {
         res.status(200).json({
            success: true,
            message: 'No leaves data found for this employee.',
            data: []
         });
      }
   } catch (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
   }
});

//Emp leaves
router.get('/list-leaves/:emp_id', async (req, res) => {
   const emp_id = req.params.emp_id;

   const query = `
       SELECT emp_id, from_date, to_date, duration, description, status, created_at
       FROM leaves_application
       WHERE emp_id = ?
       ORDER BY created_at DESC
   `;

   try {
      const [result] = await con.query(query, [emp_id]);

      if (result.length > 0) {
         res.status(200).json({
            message: 'Leave applications fetched successfully.',
            data: result
         });
      } else {
         res.status(200).json({
            message: 'No leave applications found for this employee.',
            data: []
         });
      }
   } catch (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
   }
});

//All leaves
router.get('/all-leaves', async (req, res) => {
   const query = `
       SELECT la.id, la.emp_id, la.from_date, la.to_date, la.duration, la.description, la.status, la.created_at,
              l.first_name, l.last_name, l.total_leaves
       FROM leaves_application la
       INNER JOIN leaves l ON la.emp_id = l.emp_id
       ORDER BY la.created_at DESC
   `;

   try {

      const [result] = await con.query(query);
      if (result.length > 0) {
         res.status(200).json({
            message: 'Leave applications fetched successfully.',
            data: result
         });
      } else {
         res.status(200).json({
            message: 'No leave applications found.',
            data: []
         });
      }
   } catch (err) {
      console.error('Error fetching leave applications:', err);
      return res.status(500).json({ error: 'An error occurred while fetching leave applications.' });
   }
});

//Approve leaves
// router.put('/approve-leave/:id', async (req, res) => {
//    const leaveId = req.params.id;
//    const { status } = req.body;
//    if (!status) {
//       return res.status(400).json({ error: 'Status is required' });
//    }

//    try {
//       const query = `UPDATE leaves_application SET status = ? WHERE id = ?`;
//       const [result] = await con.query(query, [status, leaveId]);
//       if (result.affectedRows > 0) {
//          res.status(200).json({ message: 'Leave status updated successfully.' });
//       } else {
//          res.status(404).json({ message: 'Leave application not found.' });
//       }
//    } catch (err) {
//       console.error('Error updating leave status:', err);
//       res.status(500).json({ error: 'Database update failed.' });
//    }
// });

router.put('/approve-leave/:id', async (req, res) => {
   const leaveId = req.params.id;
   const { status } = req.body;

   if (!status) {
      return res.status(400).json({ error: 'Status is required' });
   }

   try {
      const leaveApplicationQuery = 'SELECT emp_id, duration FROM leaves_application WHERE id = ?';
      const [leaveApplicationResult] = await con.query(leaveApplicationQuery, [leaveId]);

      if (leaveApplicationResult.length === 0) {
         return res.status(404).json({ message: 'Leave application not found.' });
      }

      const { emp_id, duration } = leaveApplicationResult[0];

      const updateLeaveApplicationQuery = `
         UPDATE leaves_application
         SET status = ?, holiday_taken = ?
         WHERE id = ?
      `;
      await con.query(updateLeaveApplicationQuery, [status, duration, leaveId]);

      const leaveQuery = 'SELECT total_leaves FROM leaves WHERE emp_id = ?';
      const [leaveResult] = await con.query(leaveQuery, [emp_id]);

      if (leaveResult.length === 0) {
         return res.status(404).json({ message: 'Employee not found.' });
      }

      let total_leaves = leaveResult[0].total_leaves;

      const updatedTotalLeaves = total_leaves - duration;

      const updateLeaveQuery = 'UPDATE leaves SET total_leaves = ? WHERE emp_id = ?';
      await con.query(updateLeaveQuery, [updatedTotalLeaves, emp_id]);

      res.status(200).json({ message: 'Leave status updated and leaves deducted successfully.' });

   } catch (err) {
      console.error('Error updating leave status:', err);
      res.status(500).json({ error: 'Database update failed.' });
   }
});

//Reject leaves
// router.put('/reject-leave/:id', async (req, res) => {
//    const leaveId = req.params.id;
//    const { status } = req.body;

//    if (!status) {
//       return res.status(400).json({ error: 'Status is required' });
//    }

//    const connection = await con.getConnection();

//    try {
//       await connection.beginTransaction();

//       const [leaveDetails] = await connection.query(
//          `SELECT emp_id, from_date, to_date, duration, holiday_taken, holiday_remaining
//           FROM leaves_application WHERE id = ?`,
//          [leaveId]
//       );

//       if (leaveDetails.length === 0) {
//          await connection.rollback();
//          return res.status(404).json({ message: 'Leave application not found.' });
//       }

//       const leaveData = leaveDetails[0];
//       const { emp_id, duration, holiday_taken, holiday_remaining } = leaveData;

//       const durationValue = parseFloat(duration);
//       const holidayTakenValue = parseFloat(holiday_taken);
//       const holidayRemainingValue = parseFloat(holiday_remaining);

//       const updatedHolidayTaken = holidayTakenValue - durationValue;
//       const updatedHolidayRemaining = holidayRemainingValue + durationValue;

//       const updateLeaveApplicationQuery = `
//          UPDATE leaves_application
//          SET status = ?, holiday_taken = ?, holiday_remaining = ?
//          WHERE id = ?`;
//       await connection.query(updateLeaveApplicationQuery, [
//          status,
//          updatedHolidayTaken,
//          updatedHolidayRemaining,
//          leaveId,
//       ]);

//       const [leavesData] = await connection.query(
//          `SELECT total_leaves FROM leaves WHERE emp_id = ?`,
//          [emp_id]
//       );

//       if (leavesData.length === 0) {
//          await connection.rollback();
//          return res.status(404).json({ message: 'Employee leave data not found.' });
//       }

//       const totalLeaves = parseFloat(leavesData[0].total_leaves);
//       const updatedTotalLeaves = totalLeaves + durationValue;

//       const updateLeavesQuery = `
//          UPDATE leaves SET total_leaves = ? WHERE emp_id = ?`;
//       await connection.query(updateLeavesQuery, [updatedTotalLeaves, emp_id]);
//       await connection.commit();

//       res.status(200).json({
//          message: 'Leave application rejected successfully.',
//       });
//    } catch (err) {
//       await connection.rollback();
//       console.error('Error rejecting leave application:', err);
//       res.status(500).json({ error: 'Failed to reject leave application.' });
//    } finally {
//       connection.release();
//    }
// });

router.put('/reject-leave/:id', async (req, res) => {
   const leaveId = req.params.id;
   const { status } = req.body;

   if (!status) {
      return res.status(400).json({ error: 'Status is required' });
   }

   try {
      const [leaveDetails] = await con.query(
         `SELECT id FROM leaves_application WHERE id = ?`,
         [leaveId]
      );

      if (leaveDetails.length === 0) {
         return res.status(404).json({ message: 'Leave application not found.' });
      }

      const updateLeaveApplicationQuery = `
         UPDATE leaves_application
         SET status = ?
         WHERE id = ?`;
      const [updateResult] = await con.query(updateLeaveApplicationQuery, [status, leaveId]);

      if (updateResult.affectedRows > 0) {
         return res.status(200).json({
            message: 'Leave application rejected successfully.',
         });
      } else {
         return res.status(500).json({ error: 'Failed to reject leave application.' });
      }
   } catch (err) {
      console.error('Error rejecting leave application:', err);
      return res.status(500).json({ error: 'Internal server error.' });
   }
});

//All employee leaves details
// router.get('/all-employee/leaves', async (req, res) => {
//    try {
//       const query = `
//            SELECT
//                e.emp_id,
//                CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
//                e.holiday AS total_leaves,
//                COALESCE(SUM(l.holiday_taken), 0) AS leaves_taken,
//                COALESCE(
//                    (SELECT l2.holiday_remaining
//                     FROM leaves_application l2
//                     WHERE l2.emp_id = e.emp_id
//                     ORDER BY l2.updated_at DESC
//                     LIMIT 1),
//                    e.holiday
//                ) AS leaves_remaining
//            FROM
//                employee_data e
//            LEFT JOIN
//                leaves_application l ON e.emp_id = l.emp_id
//            GROUP BY
//                e.emp_id
//        `;

//       const [results] = await con.execute(query);

//       res.status(200).json(results);
//    } catch (error) {
//       console.error('Error fetching employee leave details:', error);
//       res.status(500).json({ message: 'Internal server error' });
//    }
// });

router.get('/all-employee/leaves', async (req, res) => {
   try {
      const query = `
           SELECT
               e.emp_id,
               CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
               e.holiday AS total_leaves,
               COALESCE(SUM(CASE WHEN l.status = 2 THEN l.holiday_taken ELSE 0 END), 0) AS leaves_taken,
               e.holiday - COALESCE(
                   SUM(CASE WHEN l.status = 2 THEN l.holiday_taken ELSE 0 END), 0
               ) AS leaves_remaining
           FROM
               employee_data e
           LEFT JOIN
               leaves_application l ON e.emp_id = l.emp_id
           GROUP BY
               e.emp_id
       `;

      const [results] = await con.execute(query);

      res.status(200).json(results);
   } catch (error) {
      console.error('Error fetching employee leave details:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});


//Dashboard
router.get('/employees-count', async (req, res) => {
   const query = 'SELECT COUNT(*) AS total_employees FROM employee_data';

   try {
      const [results] = await con.query(query);
      const totalEmployees = results[0].total_employees;
      res.status(200).json({
         message: 'Total employees count fetched successfully',
         data: {
            total_employees: totalEmployees
         }
      });
   } catch (err) {
      console.error('Database query error:', err.message);
      return res.status(500).json({ error: 'Database error', details: err.message });
   }
});

//
router.get('/projects-count', async (req, res) => {
   const query = 'SELECT COUNT(*) AS total_projects FROM projects';

   try {
      const [results] = await con.query(query);
      const totalProjects = results[0].total_projects;
      res.status(200).json({
         message: 'Total project count fetched successfully',
         data: {
            total_projects: totalProjects
         }
      });
   } catch (err) {
      console.error('Database query error:', err.message);
      return res.status(500).json({ error: 'Database error', details: err.message });
   }
});

//
router.get('/departments-count', async (req, res) => {
   const query = 'SELECT COUNT(*) AS total_departments FROM departments';

   try {
      const [results] = await con.query(query);
      const totalDepartments = results[0].total_departments;
      res.status(200).json({
         status: 200,
         message: 'Total department count fetched successfully',
         data: {
            total_departments: totalDepartments
         }
      });
   } catch (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
   }
});

//
router.get('/designation-count', async (req, res) => {
   const query = 'SELECT COUNT(*) AS total_designations FROM designation';

   try {
      const [results] = await con.query(query);
      const totalDesignations = results[0]?.total_designations || 0;
      res.status(200).json({
         status: 200,
         message: 'Designation count fetched successfully',
         data: {
            total_designations: totalDesignations,
         },
      });
   } catch (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
   }
});

//
router.get('/fetch-employee/:emp_id', async (req, res) => {
   const { emp_id } = req.params;

   try {
      const [rows] = await con.query('SELECT emp_position, assigned_project, emp_department FROM employee_data WHERE emp_id = ?', [emp_id]);

      if (rows.length > 0) {
         const employee = rows[0];
         res.status(200).json({
            status: 200,
            message: 'Employee details fetched successfully',
            data: {
               emp_position: employee.emp_position || 'Not Assigned',
               assigned_project: employee.assigned_project || 'Not Assigned',
               emp_department: employee.emp_department || 'Not Assigned'
            }
         });
      } else {
         res.status(404).json({
            status: 404,
            message: 'Employee not found',
            data: {}
         });
      }
   } catch (error) {
      console.error(error);
      res.status(500).json({
         status: 500,
         message: 'Server Error',
         data: {}
      });
   }
});

//Add Documents
router.post('/upload-document', upload.single('doc_file'), async (req, res) => {
   try {
      const { sender, send_to: receiver, emp_id } = req.body;
      const docFile = req.file ? req.file.filename : req.body.doc_file;

      if (!docFile) {
         return res.status(400).json({ error: 'No file uploaded' });
      }

      const date = new Date();
      let senderId = sender;
      let receiverId = receiver;

      if (senderId === ADMIN_ID) {
         receiverId = receiver;
      } else {
         senderId = emp_id || sender;
         receiverId = ADMIN_ID;
      }

      const query = `INSERT INTO documents (sender, receiver, doc_file, date) VALUES (?, ?, ?, ?)`;
      const [result] = await con.query(query, [senderId, receiverId, docFile, date]);

      return res.status(200).json({
         message: 'Document uploaded successfully',
         documentId: result.insertId,
         filePath: `http://127.0.0.1:3000/uploads/${docFile}`
      });
   } catch (err) {
      console.error('Error inserting document:', err);
      return res.status(500).json({ error: 'Error uploading document', details: err.message });
   }
});

//List Documents
router.get('/fetch-documents', async (req, res) => {
   try {
      const { role, emp_id } = req.query;

      if (role === 'ADMIN') {
         const [documents] = await con.query('SELECT id, sender, receiver, doc_file, date, created_at FROM documents');
         res.status(200).json({ success: true, data: documents });
      } else if (role === 'EMPLOYEE') {
         const [employee] = await con.query('SELECT joining_date FROM employee_data WHERE emp_id = ?', [emp_id]);
         if (!employee.length) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
         }
         const joiningDate = employee[0].joining_date;
         const [documents] = await con.query(
            `SELECT id, sender, receiver, doc_file, date, created_at
             FROM documents
             WHERE (receiver = ? OR receiver = '0' OR sender = ?)
             AND date >= ?`,
            [emp_id, emp_id, joiningDate]
         );

         res.status(200).json({
            message: documents.length > 0 ? 'Documents fetched successfully.' : 'No documents found.',
            data: documents
         });
      } else {
         res.status(400).json({ success: false, message: 'Invalid role' });
      }
   } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ success: false, message: 'Server error' });
   }
});

//Delete Documents
router.delete('/delete/document/:id', async (req, res) => {
   try {
      const { id } = req.params;
      const result = await con.query('DELETE FROM documents WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
         return res.status(404).json({ message: 'document not found.' });
      }

      res.status(200).json({ message: 'Document deleted successfully.' });
   } catch (error) {
      console.error('Error deleting document:', error);
      res.status(500).json({ error: 'Failed to delete document.' });
   }
});

//add paySlips
router.post('/add/pay_slips', upload.single('doc_file'), async (req, res) => {
   try {
      const { send_to, first_name, last_name } = req.body;
      const docFile = req.file ? req.file.filename : null;
      const sender = 1;
      const currentDate = new Date().toISOString().split('T')[0];

      if (!send_to || !docFile) {
         return res.status(400).json({ message: 'Please provide all required fields' });
      }

      const paySlipSql = `INSERT INTO pay_slips (sender, receiver, doc_file, date) VALUES (?, ?, ?, ?)`;
      const [paySlipResult] = await con.query(paySlipSql, [sender, send_to, docFile, currentDate]);

      const message = `Admin sent pay slips to employee ${first_name} ${last_name}`;

      const notificationSql = `INSERT INTO notification (sender, receiver, message, date) VALUES (?, ?, ?, ?)`;
      await con.query(notificationSql, [sender, send_to, message, currentDate]);

      return res.status(200).json({
         message: 'Pay-slips uploaded successfully',
         paySlipsId: paySlipResult.insertId,
         filePath: `http://127.0.0.1:3000/uploads/${docFile}`
      });
   } catch (err) {
      console.error('Error inserting document:', err);
      return res.status(500).json({ error: 'Error uploading document', details: err.message });
   }
});

//list payslips
router.get('/fetch-pay-slips', async (req, res) => {
   try {
      const { role, emp_id } = req.query;

      if (role === 'ADMIN') {
         const [paySlips] = await con.query('SELECT id, sender, receiver, doc_file, date,created_at FROM pay_slips');
         res.status(200).json({ success: true, data: paySlips });
      } else if (role === 'EMPLOYEE') {
         const [paySlips] = await con.query(
            `SELECT id, sender, receiver, doc_file, date,created_at
             FROM pay_slips
             WHERE receiver = ? OR receiver = '0' OR sender = ?`,
            [emp_id, emp_id]
         );
         res.status(200).json({
            message: paySlips.length > 0 ? 'Pay slips fetched successfully.' : 'No pay slips found.',
            data: paySlips
         });
      } else {
         res.status(400).json({ success: false, message: 'Invalid role' });
      }
   } catch (error) {
      console.error('Error fetching pay slips:', error);
      res.status(500).json({ success: false, message: 'Server error' });
   }
});

//update paySlips
router.put('/update/pay_slips/:id', upload.single('doc_file'), async (req, res) => {
   try {
      const { id } = req.params;
      const { send_to } = req.body;
      const docFile = req.file ? req.file.filename : null;
      const currentDate = new Date().toISOString().split('T')[0];

      if (!send_to && !docFile) {
         return res.status(400).json({ message: 'Please provide at least one field to update' });
      }

      let sql = `UPDATE pay_slips SET `;
      const values = [];

      if (send_to) {
         sql += `receiver = ?, `;
         values.push(send_to);
      }

      if (docFile) {
         sql += `doc_file = ?, `;
         values.push(docFile);
      }

      sql += `date = ? WHERE id = ?`;
      values.push(currentDate, id);

      const [result] = await con.query(sql, values);

      if (result.affectedRows === 0) {
         return res.status(404).json({ message: 'Pay slips record not found' });
      }

      return res.status(200).json({
         message: 'Pay slips updated successfully',
         paySlipsId: id,
         filePath: docFile ? `http://127.0.0.1:3000/uploads/${docFile}` : null
      });
   } catch (err) {
      console.error('Error updating document:', err);
      return res.status(500).json({ error: 'Error updating document', details: err.message });
   }
});

//delete paySlips
router.delete('/delete/pay_slips/:id', async (req, res) => {
   try {
      const { id } = req.params;
      const result = await con.query('DELETE FROM pay_slips WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
         return res.status(404).json({ message: 'pay_slips record not found' });
      }

      return res.status(200).json({ message: 'pay_slips deleted successfully' });
   } catch (err) {
      console.error('Error deleting pay_slips record:', err);
      return res.status(500).json({ error: 'Error deleting pay_slips record', details: err.message });
   }
});

//add p60
router.post('/add/p60', upload.single('doc_file'), async (req, res) => {
   try {
      const { send_to } = req.body;
      const docFile = req.file ? req.file.filename : null;
      const sender = 1;
      const currentDate = new Date().toISOString().split('T')[0];
      if (!send_to || !docFile) {
         return res.status(400).json({ message: 'Please provide all required fields' });
      }

      const sql = `INSERT INTO p60 (sender, receiver, doc_file, date) VALUES (?, ?, ?, ?)`;
      const [result] = await con.query(sql, [sender, send_to, docFile, currentDate]);

      return res.status(200).json({
         message: 'P60 uploaded successfully',
         p60Id: result.insertId,
         filePath: `http://127.0.0.1:3000/uploads/${docFile}`
      });
   } catch (err) {
      console.error('Error inserting document:', err);
      return res.status(500).json({ error: 'Error uploading document', details: err.message });
   }
});

//list p60
router.get('/fetch-p60', async (req, res) => {
   try {
      const { role, emp_id } = req.query;

      if (role === 'ADMIN') {
         const [p60Data] = await con.query('SELECT id, sender, receiver, doc_file, date,created_at FROM p60');
         res.status(200).json({ success: true, data: p60Data });
      } else if (role === 'EMPLOYEE') {
         const [p60Data] = await con.query(
            `SELECT id, sender, receiver, doc_file, date,created_at
             FROM p60
             WHERE receiver = ? OR receiver = '0' OR sender = ?`,
            [emp_id, emp_id]
         );
         res.status(200).json({
            message: p60Data.length > 0 ? 'P60 data fetched successfully.' : 'No p60 data found.',
            data: p60Data
         });
      } else {
         res.status(400).json({ success: false, message: 'Invalid role' });
      }
   } catch (error) {
      console.error('Error fetching pay slips:', error);
      res.status(500).json({ success: false, message: 'Server error' });
   }
});

//update p60
router.put('/update/p60/:id', upload.single('doc_file'), async (req, res) => {
   try {
      const { id } = req.params;
      const { send_to } = req.body;
      const docFile = req.file ? req.file.filename : null;
      const currentDate = new Date().toISOString().split('T')[0];

      if (!send_to && !docFile) {
         return res.status(400).json({ message: 'Please provide at least one field to update' });
      }

      let sql = `UPDATE p60 SET `;
      const values = [];

      if (send_to) {
         sql += `receiver = ?, `;
         values.push(send_to);
      }

      if (docFile) {
         sql += `doc_file = ?, `;
         values.push(docFile);
      }

      sql += `date = ? WHERE id = ?`;
      values.push(currentDate, id);

      const [result] = await con.query(sql, values);

      if (result.affectedRows === 0) {
         return res.status(404).json({ message: 'P60 record not found' });
      }

      return res.status(200).json({
         message: 'P60 updated successfully',
         p60Id: id,
         filePath: docFile ? `http://127.0.0.1:3000/uploads/${docFile}` : null
      });
   } catch (err) {
      console.error('Error updating document:', err);
      return res.status(500).json({ error: 'Error updating document', details: err.message });
   }
});

//delete p60
router.delete('/delete/p60/:id', async (req, res) => {
   try {
      const { id } = req.params;
      const result = await con.query('DELETE FROM p60 WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
         return res.status(404).json({ message: 'P60 record not found' });
      }

      return res.status(200).json({ message: 'P60 deleted successfully' });
   } catch (err) {
      console.error('Error deleting P60 record:', err);
      return res.status(500).json({ error: 'Error deleting P60 record', details: err.message });
   }
});

//get notification
router.get('/get-notification', async (req, res) => {
   const { role, emp_id } = req.query;

   try {
      let query = '';
      let params = [];

      if (role === 'ADMIN') {
         query = 'SELECT id, message, date, status FROM notification WHERE receiver = 1 AND status = 0';
      } else if (role === 'EMPLOYEE') {
         query = 'SELECT id, message, date, status FROM notification WHERE receiver = ? AND status = 0';
         params = [emp_id];
      } else {
         return res.status(400).json({ error: 'Invalid role provided.' });
      }

      const [notifications] = await con.query(query, params);
      const notificationCount = notifications.length;

      res.status(200).json({
         count: notificationCount,
         notifications: notifications,
      });
   } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'An error occurred while fetching notifications.' });
   }
});

//update notification
router.put('/update-notification', async (req, res) => {
   const { notificationIds } = req.body;

   if (!notificationIds || notificationIds.length === 0) {
      return res.status(400).json({ error: 'No notifications provided to update.' });
   }

   try {
      const placeholders = notificationIds.map(() => '?').join(',');
      const query = `UPDATE notification SET status = 1 WHERE id IN (${placeholders})`;
      await con.query(query, notificationIds);

      res.status(200).json({ message: 'Notification statuses updated successfully.' });
   } catch (error) {
      console.error('Error updating notification statuses:', error);
      res.status(500).json({ error: 'An error occurred while updating notifications.' });
   }
});

router.get('/logout', (req, res) => {
   res.clearCookie('token');
   return res.json({ Status: true });
});

export { router as AdminRoutes };