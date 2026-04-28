class CreateOrders < ActiveRecord::Migration[6.1]
  def change
    create_table :orders do |t|
      t.references :user, null: false, foreign_key: true
      t.string :order_number, null: false, index: { unique: true }
      
      # Customer Information
      t.string :customer_name, null: false
      t.string :customer_email, null: false
      t.string :customer_phone, null: false
      
      # Billing Address
      t.string :billing_first_name
      t.string :billing_last_name
      t.string :billing_company
      t.string :billing_address1, null: false
      t.string :billing_address2
      t.string :billing_city, null: false
      t.string :billing_state, null: false
      t.string :billing_postal_code, null: false
      t.string :billing_country, null: false, default: 'Thailand'
      t.string :billing_phone
      
      # Shipping Address
      t.boolean :shipping_same_as_billing, default: true
      t.string :shipping_first_name
      t.string :shipping_last_name
      t.string :shipping_company
      t.string :shipping_address1
      t.string :shipping_address2
      t.string :shipping_city
      t.string :shipping_state
      t.string :shipping_postal_code
      t.string :shipping_country, default: 'Thailand'
      t.string :shipping_phone
      
      # Order Details
      t.string :currency, default: 'THB'
      t.decimal :subtotal, precision: 12, scale: 2, default: 0.0
      t.decimal :shipping_total, precision: 12, scale: 2, default: 0.0
      t.decimal :tax_total, precision: 12, scale: 2, default: 0.0
      t.decimal :discount_total, precision: 12, scale: 2, default: 0.0
      t.decimal :total, precision: 12, scale: 2, default: 0.0
      t.decimal :total_tax, precision: 12, scale: 2, default: 0.0
      
      # Payment
      t.string :payment_method
      t.string :payment_reference
      t.string :payment_status, default: 'pending'  # pending, authorized, paid, partially_refunded, refunded, voided
      t.datetime :paid_at
      
      # Fulfillment
      t.string :fulfillment_status, default: 'unfulfilled'  # unfulfilled, partially_fulfilled, fulfilled, delivered, cancelled
      t.datetime :fulfilled_at
      t.datetime :delivered_at
      t.string :tracking_number
      t.string :tracking_url
      
      # Notes
      t.text :customer_notes
      t.text :internal_notes
      
      # Status
      t.string :status, default: 'pending'  # pending, processing, on_hold, completed, cancelled, refunded, failed
      t.boolean :tax_exempt, default: false
      t.boolean :tax_included, default: true
      
      # Shipping
      t.string :shipping_method
      t.string :shipping_provider
      t.decimal :shipping_tax, precision: 12, scale: 2, default: 0.0
      
      # Discounts
      t.string :discount_code
      t.decimal :discount_amount, precision: 12, scale: 2, default: 0.0
      
      # Refund
      t.decimal :refunded_amount, precision: 12, scale: 2, default: 0.0
      t.datetime :refunded_at
      t.text :refund_reason
      
      # IP and Device
      t.string :ip_address
      t.string :user_agent
      
      # Financials
      t.decimal :total_discounts, precision: 12, scale: 2, default: 0.0
      t.decimal :total_line_items, precision: 12, scale: 2, default: 0.0
      t.decimal :total_price, precision: 12, scale: 2, default: 0.0
      t.decimal :total_tip, precision: 12, scale: 2, default: 0.0
      
      t.timestamps
      t.datetime :cancelled_at
    end
    
    add_index :orders, :order_number, unique: true
    add_index :orders, :status
    add_index :orders, :payment_status
    add_index :orders, :fulfillment_status
    
    # Order Items
    create_table :order_items do |t|
      t.references :order, null: false, foreign_key: true
      t.references :product, null: false, foreign_key: true
      t.references :variant, foreign_key: { to_table: :product_variants }
      t.references :vendor, null: false, foreign_key: { to_table: :users }
      
      # Product Info (snapshot at time of purchase)
      t.string :name, null: false
      t.text :description
      t.string :sku
      t.string :barcode
      
      # Pricing
      t.decimal :price, precision: 12, scale: 2, null: false
      t.decimal :compare_at_price, precision: 12, scale: 2
      t.decimal :cost_per_item, precision: 12, scale: 2
      
      # Quantity
      t.integer :quantity, null: false
      t.string :unit, default: 'piece'  # piece, kg, g, etc.
      
      # Totals
      t.decimal :total_discount, precision: 12, scale: 2, default: 0.0
      t.decimal :total_price, precision: 12, scale: 2, null: false
      
      # Status
      t.string :fulfillment_status, default: 'unfulfilled'
      t.string :return_status
      
      # Tax
      t.boolean :taxable, default: true
      t.decimal :tax_amount, precision: 12, scale: 2, default: 0.0
      
      # Shipping
      t.boolean :requires_shipping, default: true
      
      t.timestamps
    end
    
    add_index :order_items, [:order_id, :product_id]
    add_index :order_items, :vendor_id
    
    # Order Vendors (for multi-vendor orders)
    create_table :order_vendors do |t|
      t.references :order, null: false, foreign_key: true
      t.references :vendor, null: false, foreign_key: { to_table: :users }
      
      # Vendor-specific order details
      t.string :order_number, null: false
      t.string :status, default: 'pending'  # pending, processing, ready_for_pickup, shipped, delivered, cancelled
      t.string :tracking_number
      t.string :tracking_url
      t.string :shipping_method
      t.decimal :shipping_cost, precision: 12, scale: 2, default: 0.0
      t.decimal :subtotal, precision: 12, scale: 2, default: 0.0
      t.decimal :tax, precision: 12, scale: 2, default: 0.0
      t.decimal :total, precision: 12, scale: 2, default: 0.0
      t.decimal :commission_rate, precision: 5, scale: 2, default: 7.0
      t.decimal :commission_amount, precision: 12, scale: 2, default: 0.0
      t.decimal :payout_amount, precision: 12, scale: 2, default: 0.0
      t.string :payout_status, default: 'pending'  # pending, processing, paid, failed
      
      t.timestamps
    end
    
    add_index :order_vendors, [:order_id, :vendor_id], unique: true
    add_index :order_vendors, :order_number, unique: true
    
    # Order Status History
    create_table :order_status_histories do |t|
      t.references :order, null: false, foreign_key: true
      t.string :status, null: false
      t.text :message
      t.string :performed_by_type
      t.bigint :performed_by_id
      t.jsonb :metadata
      
      t.timestamps
    end
    
    add_index :order_status_histories, [:order_id, :status]
    add_index :order_status_histories, [:performed_by_type, :performed_by_id], name: 'index_order_status_histories_on_performed'
  end
end
