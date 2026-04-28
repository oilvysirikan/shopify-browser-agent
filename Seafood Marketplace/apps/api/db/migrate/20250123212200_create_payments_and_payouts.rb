class CreatePaymentsAndPayouts < ActiveRecord::Migration[6.1]
  def change
    # Payments Table
    create_table :payments do |t|
      t.references :order, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      
      # Payment Details
      t.string :payment_method, null: false  # credit_card, promptpay, bank_transfer, cash_on_delivery
      t.string :payment_gateway, null: false  # omise, stripe, manual
      t.string :transaction_id, null: false
      t.string :status, null: false  # pending, authorized, captured, refunded, failed, voided
      
      # Amounts
      t.decimal :amount, precision: 12, scale: 2, null: false
      t.decimal :fee, precision: 12, scale: 2, default: 0.0
      t.decimal :tax, precision: 12, scale: 2, default: 0.0
      t.decimal :net_amount, precision: 12, scale: 2, null: false
      
      # Credit Card Details (encrypted)
      t.string :card_brand
      t.string :card_last4
      t.integer :card_exp_month
      t.integer :card_exp_year
      
      # Bank Transfer Details
      t.string :bank_name
      t.string :account_number
      t.string :account_name
      
      # Omise Specific
      t.string :omise_charge_id
      t.string :omise_source_id
      t.string :omise_transaction_id
      
      # Metadata
      t.jsonb :gateway_response
      t.text :description
      t.string :failure_code
      t.text :failure_message
      
      # Timestamps
      t.datetime :authorized_at
      t.datetime :captured_at
      t.datetime :refunded_at
      t.datetime :failed_at
      t.timestamps
    end
    
    add_index :payments, :transaction_id, unique: true
    add_index :payments, :status
    add_index :payments, :payment_method
    add_index :payments, :omise_charge_id, unique: true
    
    # Payment Refunds
    create_table :payment_refunds do |t|
      t.references :payment, null: false, foreign_key: true
      t.references :order, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      
      # Refund Details
      t.string :refund_id, null: false
      t.string :status, null: false  # pending, processed, failed
      t.decimal :amount, precision: 12, scale: 2, null: false
      t.string :currency, default: 'THB'
      t.text :reason
      
      # Gateway Response
      t.jsonb :gateway_response
      t.string :failure_code
      t.text :failure_message
      
      t.timestamps
    end
    
    add_index :payment_refunds, :refund_id, unique: true
    
    # Payouts to Vendors
    create_table :payouts do |t|
      t.references :vendor, null: false, foreign_key: { to_table: :users }
      t.references :order_vendor, foreign_key: true
      
      # Payout Details
      t.string :payout_id, null: false
      t.string :status, null: false  # pending, processing, paid, failed, cancelled
      t.string :payout_method, null: false  # bank_transfer, promptpay
      
      # Amounts
      t.decimal :amount, precision: 12, scale: 2, null: false
      t.decimal :fee, precision: 12, scale: 2, default: 0.0
      t.decimal :tax, precision: 12, scale: 2, default: 0.0
      t.decimal :net_amount, precision: 12, scale: 2, null: false
      
      # Bank Transfer Details
      t.string :bank_name
      t.string :account_number
      t.string :account_name
      
      # PromptPay Details
      t.string :promptpay_number
      t.string :promptpay_name
      
      # Processing
      t.datetime :paid_at
      t.datetime :processed_at
      t.datetime :failed_at
      t.text :failure_reason
      
      # Metadata
      t.jsonb :metadata
      t.text :notes
      
      t.timestamps
    end
    
    add_index :payouts, :payout_id, unique: true
    add_index :payouts, :status
    
    # Payout Items (for batch payouts)
    create_table :payout_items do |t|
      t.references :payout, null: false, foreign_key: true
      t.references :order_vendor, null: false, foreign_key: true
      
      # Amounts
      t.decimal :amount, precision: 12, scale: 2, null: false
      t.decimal :fee, precision: 12, scale: 2, default: 0.0
      t.decimal :tax, precision: 12, scale: 2, default: 0.0
      t.decimal :net_amount, precision: 12, scale: 2, null: false
      
      # Status
      t.string :status, null: false  # pending, processing, paid, failed
      t.text :failure_reason
      
      t.timestamps
    end
    
    # Transaction Logs
    create_table :transaction_logs do |t|
      t.string :transaction_type, null: false  # payment, refund, payout, adjustment
      t.references :transactionable, polymorphic: true, null: false
      
      # Amounts
      t.decimal :amount, precision: 12, scale: 2, null: false
      t.string :currency, default: 'THB'
      
      # Parties
      t.references :user, foreign_key: true
      t.references :vendor, foreign_key: { to_table: :users }
      t.references :order, foreign_key: true
      
      # Status
      t.string :status, null: false
      t.text :description
      
      # Metadata
      t.jsonb :metadata
      
      t.timestamps
    end
    
    add_index :transaction_logs, [:transactionable_type, :transactionable_id], name: 'index_transaction_logs_on_transactionable'
    
    # Commission Rates
    create_table :commission_rates do |t|
      t.references :vendor, foreign_key: { to_table: :users }
      t.string :name, null: false
      t.decimal :rate, precision: 5, scale: 2, null: false
      t.boolean :is_default, default: false
      t.boolean :is_active, default: true
      t.jsonb :conditions
      
      t.timestamps
    end
    
    add_index :commission_rates, :is_default
    add_index :commission_rates, :is_active
  end
end
