import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

export const getTenant = async (req: Request, res: Response) => {
  try {
    // @ts-ignore - user is attached by auth middleware
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const tenant = await prisma.tenant.findFirst({
      where: { userId },
      include: {
        settings: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    res.json(tenant);
  } catch (error) {
    logger.error('Get tenant error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateTenant = async (req: Request, res: Response) => {
  try {
    // @ts-ignore - user is attached by auth middleware
    const userId = req.user?.userId;
    const { name, settings } = req.body;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const tenant = await prisma.tenant.findFirst({
      where: { userId },
    });

    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name,
        settings: settings ? {
          upsert: {
            create: settings,
            update: settings,
          },
        } : undefined,
      },
      include: {
        settings: true,
      },
    });

    res.json(updatedTenant);
  } catch (error) {
    logger.error('Update tenant error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
