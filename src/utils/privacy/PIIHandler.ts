import crypto from 'crypto';

interface Customer {
  id: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  addresses?: any[];
  createdAt: string | Date;
  totalSpent: number;
  ordersCount: number;
  [key: string]: any;
}

interface AnonymizedCustomer {
  id: string;
  email: null;
  phone: null;
  firstName: null;
  lastName: null;
  addresses: [];
  createdAt: string | Date;
  totalSpent: number;
  ordersCount: number;
}

/**
 * PIIHandler handles detection and sanitization of Personally Identifiable Information
 */
export class PIIHandler {
  private piiPatterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    ssn: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g,
    ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  };
  
  /**
   * Sanitize data by removing or redacting PII
   */
  sanitize(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }
    
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      // Handle special cases like Date objects
      if (data instanceof Date) {
        return data;
      }
      
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip PII fields entirely or redact them
        if (this.isPIIField(key)) {
          sanitized[key] = this.getRedactedValue(key, value);
        } else {
          sanitized[key] = this.sanitize(value);
        }
      }
      return sanitized;
    }
    
    return data;
  }
  
  /**
   * Anonymize customer data by removing all PII
   */
  anonymize(customerData: Customer): AnonymizedCustomer {
    return {
      id: this.hashId(customerData.id),
      email: null,
      phone: null,
      firstName: null,
      lastName: null,
      addresses: [],
      createdAt: customerData.createdAt,
      totalSpent: customerData.totalSpent,
      ordersCount: customerData.ordersCount,
    };
  }
  
  /**
   * Check if a field name indicates PII
   */
  private isPIIField(fieldName: string): boolean {
    if (!fieldName) return false;
    
    const piiFields = [
      'email', 'phone', 'address', 'firstname', 'lastname', 'name', 
      'customer', 'billing', 'shipping', 'ssn', 'social', 'passport',
      'driver', 'license', 'creditcard', 'cardnumber', 'cvv', 'expiry',
      'dob', 'birth', 'gender', 'nationalid', 'taxid', 'ipaddress'
    ];
    
    const fieldLower = fieldName.toLowerCase();
    return piiFields.some(piiField => fieldLower.includes(piiField));
  }
  
  /**
   * Sanitize a string by redacting PII patterns
   */
  private sanitizeString(str: string): string {
    if (typeof str !== 'string') return str;
    
    let sanitized = str;
    
    // Replace PII patterns
    for (const [type, pattern] of Object.entries(this.piiPatterns)) {
      sanitized = sanitized.replace(pattern, `[${type.toUpperCase()}_REDACTED]`);
    }
    
    return sanitized;
  }
  
  /**
   * Get redacted value based on field type
   */
  private getRedactedValue(fieldName: string, value: any): any {
    if (value === null || value === undefined) {
      return value;
    }
    
    const fieldLower = fieldName.toLowerCase();
    
    // Handle different PII types with appropriate redaction
    if (fieldLower.includes('email')) {
      return '[EMAIL_REDACTED]';
    }
    
    if (fieldLower.includes('phone')) {
      return '[PHONE_REDACTED]';
    }
    
    if (fieldLower.includes('name') || fieldLower.includes('firstname') || fieldLower.includes('lastname')) {
      return '[NAME_REDACTED]';
    }
    
    if (fieldLower.includes('address')) {
      return '[ADDRESS_REDACTED]';
    }
    
    if (fieldLower.includes('creditcard') || fieldLower.includes('cardnumber')) {
      return '[CREDIT_CARD_REDACTED]';
    }
    
    // For other PII fields, return a generic redaction
    return '[REDACTED]';
  }
  
  /**
   * Generate a one-way hash of an ID
   */
  private hashId(id: string): string {
    if (!id) return '';
    return crypto.createHash('sha256').update(id).digest('hex');
  }
  
  /**
   * Check if a string contains PII
   */
  containsPII(text: string): boolean {
    if (typeof text !== 'string') return false;
    
    for (const pattern of Object.values(this.piiPatterns)) {
      if (pattern.test(text)) {
        return true;
      }
    }
    
    return false;
  }
}
