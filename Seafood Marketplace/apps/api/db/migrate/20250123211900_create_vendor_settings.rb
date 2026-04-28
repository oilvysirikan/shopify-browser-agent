class CreateVendorSettings < ActiveRecord::Migration[6.1]
  def change
    create_table :vendor_settings do |t|
      t.references :user, null: false, foreign_key: true
      
      # Commission & Payment
      t.decimal :commission_rate, precision: 5, scale: 2, default: 7.0
      t.decimal :balance, precision: 12, scale: 2, default: 0.0
      t.decimal :pending_balance, precision: 12, scale: 2, default: 0.0
      t.string :bank_name
      t.string :bank_account_number
      t.string :bank_account_name
      t.string :promptpay_number
      
      # Store Settings
      t.string :store_phone
      t.string :store_email
      t.string :store_website
      t.string :store_address
      t.string :store_city
      t.string :store_state
      t.string :store_postal_code
      t.decimal :store_latitude, precision: 10, scale: 6
      t.decimal :store_longitude, precision: 10, scale: 6
      
      # Business Hours
      t.time :monday_open
      t.time :monday_close
      t.time :tuesday_open
      t.time :tuesday_close
      t.time :wednesday_open
      t.time :wednesday_close
      t.time :thursday_open
      t.time :thursday_close
      t.time :friday_open
      t.time :friday_close
      t.time :saturday_open
      t.time :saturday_close
      t.time :sunday_open
      t.time :sunday_close
      
      # Delivery Settings
      t.boolean :delivery_enabled, default: true
      t.decimal :delivery_fee, precision: 10, scale: 2, default: 0.0
      t.decimal :free_delivery_threshold, precision: 10, scale: 2
      t.integer :delivery_radius, default: 10  # in kilometers
      t.string :delivery_areas, array: true, default: []
      
      # Order Settings
      t.integer :preparation_time, default: 30  # in minutes
      t.boolean :auto_accept_orders, default: true
      t.boolean :require_minimum_order, default: false
      t.decimal :minimum_order_amount, precision: 10, scale: 2, default: 0.0
      
      # Notification Settings
      t.boolean :email_notifications, default: true
      t.boolean :sms_notifications, default: true
      t.boolean :push_notifications, default: true
      
      # Approval Status
      t.integer :approval_status, default: 0  # 0: pending, 1: approved, 2: rejected
      t.text :rejection_reason
      t.datetime :approved_at
      
      # Rating
      t.float :average_rating, default: 0.0
      t.integer :total_ratings, default: 0
      
      t.timestamps
    end
    
    add_index :vendor_settings, :approval_status
  end
end
