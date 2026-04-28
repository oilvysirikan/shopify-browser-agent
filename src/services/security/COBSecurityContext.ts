import { PrismaClient } from '@prisma/client';

export enum DecisionOutcome {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
  REQUIRE_APPROVAL = 'REQUIRE_APPROVAL'
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export interface SecurityDecision {
  allowed: boolean;
  reason: string;
  confidence: number;
  requiresApproval: boolean;
  approvalId?: string;
  metadata?: Record<string, any>;
}

export interface SecurityAuditLog {
  id: string;
  operation: string;
  resource: string;
  tenantId: string;
  userId: string;
  decision: DecisionOutcome;
  riskLevel: RiskLevel;
  confidence: number;
  reason: string;
  metadata?: Record<string, any>;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
}

export class COBSecurityContext {
  private prisma: PrismaClient;
  private currentUser: { id: string; roles: string[] };
  private currentTenant: string;
  private mTLSVerified: boolean;

  constructor(prisma: PrismaClient, currentUser: { id: string; roles: string[] }, currentTenant: string, mTLSVerified: boolean = false) {
    this.prisma = prisma;
    this.currentUser = currentUser;
    this.currentTenant = currentTenant;
    this.mTLSVerified = mTLSVerified;
  }

  private async logDecision(
    operation: string,
    resource: string,
    decision: DecisionOutcome,
    riskLevel: RiskLevel,
    confidence: number,
    reason: string,
    metadata: Record<string, any> = {}
  ): Promise<SecurityAuditLog> {
    return this.prisma.securityAuditLog.create({
      data: {
        operation,
        resource,
        tenantId: this.currentTenant,
        userId: this.currentUser.id,
        decision,
        riskLevel,
        confidence,
        reason,
        metadata,
        approvedBy: decision === DecisionOutcome.REQUIRE_APPROVAL ? null : this.currentUser.id,
        approvedAt: decision === DecisionOutcome.REQUIRE_APPROVAL ? null : new Date(),
      },
    });
  }

  private async validateTenantAccess(resourceTenantId: string): Promise<boolean> {
    // In a real implementation, you might want to check if the current user has access to this tenant
    return this.currentTenant === resourceTenantId;
  }

  private async evaluateRisk(operation: string, resource: string, context: any): Promise<{ riskLevel: RiskLevel, confidence: number, reason: string }> {
    // Default medium risk and confidence
    let riskLevel = RiskLevel.MEDIUM;
    let confidence = 0.7;
    let reason = 'Standard operation';

    // Example risk evaluation - customize based on your requirements
    if (operation.includes('delete') || operation.includes('update')) {
      riskLevel = RiskLevel.HIGH;
      confidence = 0.6;
      reason = 'Modification operation detected';
    } else if (operation.includes('read')) {
      riskLevel = RiskLevel.LOW;
      confidence = 0.9;
      reason = 'Read operation detected';
    }

    // Check if mTLS is required and verified
    if (riskLevel === RiskLevel.HIGH && !this.mTLSVerified) {
      riskLevel = RiskLevel.HIGH;
      confidence = 0.3;
      reason = 'High risk operation requires mTLS authentication';
    }

    return { riskLevel, confidence, reason };
  }

  public async authorize(
    operation: string,
    resource: string,
    resourceTenantId: string,
    context: any = {}
  ): Promise<SecurityDecision> {
    // 1. Validate tenant access
    const hasTenantAccess = await this.validateTenantAccess(resourceTenantId);
    if (!hasTenantAccess) {
      await this.logDecision(
        operation,
        resource,
        DecisionOutcome.DENY,
        RiskLevel.HIGH,
        0.9,
        'Tenant access denied',
        { resourceTenantId, currentTenant: this.currentTenant }
      );
      
      return {
        allowed: false,
        reason: 'Access to this tenant is not authorized',
        confidence: 0.9,
        requiresApproval: false
      };
    }

    // 2. Evaluate risk
    const { riskLevel, confidence, reason: riskReason } = await this.evaluateRisk(operation, resource, context);

    // 3. Make decision based on risk level
    let decision: DecisionOutcome;
    let requiresApproval = false;
    let approvalId: string | undefined;

    if (riskLevel === RiskLevel.HIGH) {
      if (this.currentUser.roles.includes('admin')) {
        decision = DecisionOutcome.ALLOW;
      } else {
        decision = DecisionOutcome.REQUIRE_APPROVAL;
        requiresApproval = true;
      }
    } else if (riskLevel === RiskLevel.MEDIUM) {
      if (this.currentUser.roles.includes('manager') || this.currentUser.roles.includes('admin')) {
        decision = DecisionOutcome.ALLOW;
      } else {
        decision = DecisionOutcome.REQUIRE_APPROVAL;
        requiresApproval = true;
      }
    } else {
      decision = DecisionOutcome.ALLOW;
    }

    // 4. Log the decision
    const auditLog = await this.logDecision(
      operation,
      resource,
      decision,
      riskLevel,
      confidence,
      riskReason,
      { context, userRoles: this.currentUser.roles }
    );

    // 5. If approval is required, create an approval request
    if (requiresApproval) {
      approvalId = auditLog.id;
      // In a real implementation, you would create an approval request here
      // and notify the appropriate approvers
    }

    return {
      allowed: decision === DecisionOutcome.ALLOW,
      reason: riskReason,
      confidence,
      requiresApproval,
      approvalId,
      metadata: {
        auditLogId: auditLog.id,
        riskLevel,
        decision
      }
    };
  }

  public async approveRequest(approvalId: string, approverId: string): Promise<SecurityDecision> {
    // In a real implementation, you would:
    // 1. Verify the approver has permission to approve
    // 2. Update the audit log
    // 3. Return the updated decision
    
    const auditLog = await this.prisma.securityAuditLog.update({
      where: { id: approvalId },
      data: {
        approvedBy: approverId,
        approvedAt: new Date(),
        decision: DecisionOutcome.ALLOW
      }
    });

    return {
      allowed: true,
      reason: 'Approved by authorized user',
      confidence: 1.0,
      requiresApproval: false,
      metadata: {
        approvedBy: approverId,
        approvedAt: new Date().toISOString()
      }
    };
  }
}

// Example usage:
/*
async function example() {
  const prisma = new PrismaClient();
  
  // Initialize security context with current user and tenant
  const securityContext = new COBSecurityContext(
    prisma,
    { id: 'user-123', roles: ['user'] },
    'tenant-456',
    true // mTLS verified
  );

  // Authorize an operation
  const decision = await securityContext.authorize(
    'delete',
    'customer:123',
    'tenant-456',
    { customerId: '123' }
  );

  console.log(decision);
  
  if (decision.requiresApproval && decision.approvalId) {
    // In a real app, this would be done by an admin/approver
    const approval = await securityContext.approveRequest(
      decision.approvalId,
      'admin-789'
    );
    console.log(approval);
  }
}
*/
