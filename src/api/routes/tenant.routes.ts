import { Router } from 'express';
import { getTenant, updateTenant } from '../controllers/tenant.controller.js';
import { validateRequest } from '../middleware/validate-request.js';
import { updateTenantSchema } from '../validations/tenant.validation.js';
import { requireAuth } from '../../middleware/jwt-auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', getTenant);
router.put('/', validateRequest(updateTenantSchema), updateTenant);

export default router;
