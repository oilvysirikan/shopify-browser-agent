class CreateProducts < ActiveRecord::Migration[6.1]
  def change
    create_table :products do |t|
      t.references :user, null: false, foreign_key: true  # vendor
      
      # Basic Info
      t.string :name, null: false
      t.text :description
      t.string :barcode
      t.string :sku
      
      # Pricing
      t.decimal :price, precision: 12, scale: 2, null: false
      t.decimal :compare_at_price, precision: 12, scale: 2
      t.decimal :cost_per_item, precision: 12, scale: 2
      t.decimal :shipping_weight, precision: 8, scale: 2  # in kg
      
      # Inventory
      t.integer :quantity, default: 0
      t.boolean :track_quantity, default: true
      t.boolean :continue_selling_when_out_of_stock, default: false
      t.boolean :physical_product, default: true
      
      # Seafood Specific
      t.string :seafood_type  # ปลา, กุ้ง, ปู, หอย, ปลาหมึก, ของแปรรูป, อื่นๆ
      t.string :origin  # ไทยนำเข้า, นำเข้า
      t.string :preservation_method  # สด, แช่แข็ง, ตากแห้ง, รมควัน, อื่นๆ
      t.string :fishing_method  # ประมงพื้นบ้าน, ประมงพาณิชย์, เพาะเลี้ยง
      t.boolean :organic, default: false
      t.boolean :sustainable, default: false
      
      # Food Safety
      t.date :harvest_date
      t.date :expiry_date
      t.string :storage_instructions
      t.string :allergen_information
      
      # Status
      t.boolean :published, default: false
      t.boolean :featured, default: false
      t.boolean :available_for_sale, default: true
      
      # Seo
      t.string :meta_title
      t.text :meta_description
      t.string :handle
      
      # Stats
      t.integer :view_count, default: 0
      t.integer :sold_count, default: 0
      t.float :average_rating, default: 0.0
      t.integer :review_count, default: 0
      
      # Shipping
      t.boolean :requires_shipping, default: true
      t.boolean :free_shipping, default: false
      
      t.timestamps
      t.datetime :deleted_at
    end
    
    add_index :products, :deleted_at
    add_index :products, :seafood_type
    add_index :products, :origin
    add_index :products, :published
    add_index :products, :available_for_sale
    
    # Product Variants
    create_table :product_variants do |t|
      t.references :product, null: false, foreign_key: true
      t.string :name, null: false  # e.g., "Size", "Weight"
      t.string :value, null: false  # e.g., "1 kg", "500g"
      t.string :sku
      t.string :barcode
      t.decimal :price, precision: 12, scale: 2, null: false
      t.decimal :compare_at_price, precision: 12, scale: 2
      t.decimal :cost_per_item, precision: 12, scale: 2
      t.integer :quantity, default: 0
      t.string :image
      
      t.timestamps
    end
    
    # Product Categories
    create_table :categories do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.text :description
      t.string :image
      t.integer :position
      t.boolean :active, default: true
      t.references :parent, foreign_key: { to_table: :categories }
      
      t.timestamps
    end
    
    add_index :categories, :slug, unique: true
    
    # Product-Category Many-to-Many
    create_table :product_categories do |t|
      t.references :product, null: false, foreign_key: true
      t.references :category, null: false, foreign_key: true
      t.integer :position
      
      t.timestamps
    end
    
    add_index :product_categories, [:product_id, :category_id], unique: true
    
    # Product Images
    create_table :product_images do |t|
      t.references :product, null: false, foreign_key: true
      t.string :image, null: false
      t.integer :position
      t.string :alt_text
      
      t.timestamps
    end
  end
end
