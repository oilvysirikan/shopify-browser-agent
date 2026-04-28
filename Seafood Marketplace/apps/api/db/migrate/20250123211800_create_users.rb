class CreateUsers < ActiveRecord::Migration[6.1]
  def change
    create_table :users do |t|
      # Authentication
      t.string :email, null: false, index: { unique: true }
      t.string :password_digest
      t.string :phone, index: true
      t.string :otp_secret
      t.datetime :otp_sent_at
      t.boolean :otp_verified, default: false
      t.string :reset_password_token
      t.datetime :reset_password_sent_at
      
      # User Info
      t.string :first_name
      t.string :last_name
      t.date :date_of_birth
      t.string :gender
      t.string :profile_picture
      
      # Roles
      t.integer :role, default: 0  # 0: customer, 1: vendor, 2: admin
      t.boolean :is_active, default: true
      t.boolean :is_verified, default: false
      
      # Vendor specific (nullable for non-vendors)
      t.string :store_name
      t.string :store_description
      t.string :store_logo
      t.string :store_banner
      t.string :tax_id
      t.string :business_registration
      t.string :food_safety_certificate
      
      # Address
      t.string :address_line1
      t.string :address_line2
      t.string :city
      t.string :state
      t.string :postal_code
      t.string :country, default: 'Thailand'
      t.decimal :latitude, precision: 10, scale: 6
      t.decimal :longitude, precision: 10, scale: 6
      
      # Stats
      t.integer :sign_in_count, default: 0
      t.datetime :current_sign_in_at
      t.datetime :last_sign_in_at
      t.string :current_sign_in_ip
      t.string :last_sign_in_ip
      
      # Timestamps
      t.timestamps
      t.datetime :deleted_at
    end
    
    add_index :users, :deleted_at
    add_index :users, :role
    add_index :users, :is_active
  end
end
