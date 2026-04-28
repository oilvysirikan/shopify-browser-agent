import { Router } from 'express';
import { login, register, refreshToken } from '../controllers/auth.controller.js';
import { validateRequest } from '../middleware/validate-request.js';
import { loginSchema, registerSchema } from '../validations/auth.validation.js';

const router = Router();

router.post('/login', validateRequest(loginSchema), login);
router.post('/register', validateRequest(registerSchema), register);
router.post('/refresh-token', refreshToken);

export default router;
