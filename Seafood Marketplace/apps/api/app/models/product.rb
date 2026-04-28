class Product < ApplicationRecord
  # Associations
  belongs_to :vendor
  belongs_to :category, optional: true
  has_many :product_images, dependent: :destroy
  has_many :order_items, dependent: :nullify
  has_many :reviews, dependent: :destroy
  
  # Enums
  enum status: { 
    draft: 'draft', 
    active: 'active', 
    out_of_stock: 'out_of_stock', 
    archived: 'archived' 
  }
  
  enum product_type: {
    fresh: 'fresh',
    frozen: 'frozen',
    processed: 'processed'
  }, _prefix: :type
  
  enum unit: {
    kg: 'kg',
    gram: 'gram',
    piece: 'piece',
    pack: 'pack',
    box: 'box'
  }, _prefix: :sold_by
  
  # Validations
  validates :name, presence: true
  validates :slug, presence: true, uniqueness: { scope: :vendor_id }
  validates :price, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :compare_at_price, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :cost_price, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :stock_quantity, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :weight_grams, numericality: { greater_than: 0 }, allow_nil: true
  
  # Callbacks
  before_validation :generate_slug, on: :create
  before_save :update_status_based_on_inventory
  before_save :set_published_at
  after_commit :reindex_products, on: [:create, :update]
  after_commit :update_vendor_stats, on: [:create, :update, :destroy]
  
  # Scopes
  scope :available, -> { where(status: :active).where('stock_quantity > 0') }
  scope :featured, -> { where(featured: true) }
  scope :recent, -> { order(created_at: :desc) }
  scope :popular, -> { order(view_count: :desc) }
  scope :best_selling, -> { order(total_sold: :desc) }
  scope :on_sale, -> { where('compare_at_price > price') }
  scope :by_vendor, ->(vendor_id) { where(vendor_id: vendor_id) }
  scope :by_category, ->(category_id) { where(category_id: category_id) }
  scope :search, ->(query) { 
    where('name ILIKE :query OR description ILIKE :query', query: "%#{query}%") 
  }
  
  # Search
  searchkick word_start: [:name, :description], 
             text_middle: [:name, :description],
             callbacks: :async
  
  def search_data
    {
      name: name,
      description: description,
      vendor_name: vendor&.store_name,
      category_name: category&.name,
      status: status,
      price: price,
      average_rating: average_rating,
      total_reviews: total_reviews,
      created_at: created_at,
      updated_at: updated_at
    }
  end
  
  # Instance Methods
  def in_stock?(quantity = 1)
    return false unless track_inventory?
    stock_quantity >= quantity
  end
  
  def available_quantity
    track_inventory? ? stock_quantity : Float::INFINITY
  end
  
  def out_of_stock?
    track_inventory? && stock_quantity <= 0
  end
  
  def low_stock?(threshold = 5)
    track_inventory? && stock_quantity <= threshold
  end
  
  def sale_percentage
    return 0 unless compare_at_price.present? && compare_at_price > price
    (((compare_at_price - price) / compare_at_price) * 100).round
  end
  
  def update_average_rating
    return if reviews.empty?
    
    product_avg = reviews.average(:product_rating).to_f.round(2)
    update_columns(
      average_rating: product_avg,
      total_reviews: reviews.count
    )
  end
  
  def increment_view_count
    increment!(:view_count)
  end
  
  def update_inventory(quantity, action: :decrease)
    return unless track_inventory?
    
    case action.to_sym
    when :decrease
      decrement!(:stock_quantity, quantity)
    when :increase
      increment!(:stock_quantity, quantity)
    when :set
      update!(stock_quantity: quantity)
    end
    
    update_status_based_on_inventory
  end
  
  def primary_image
    product_images.order(sort_order: :asc).first
  end
  
  def to_param
    slug
  end
  
  private
  
  def generate_slug
    return if slug.present?
    
    base_slug = name.parameterize
    self.slug = base_slug
    
    # Handle duplicate slugs
    count = 1
    while Product.where(slug: self.slug, vendor_id: vendor_id).exists?
      self.slug = "#{base_slug}-#{count}"
      count += 1
    end
  end
  
  def update_status_based_on_inventory
    return unless track_inventory?
    
    if stock_quantity <= 0
      self.status = :out_of_stock
    elsif status == 'out_of_stock' && stock_quantity > 0
      self.status = :active
    end
  end
  
  def set_published_at
    if status_changed? && status == 'active' && published_at.nil?
      self.published_at = Time.current
    end
  end
  
  def reindex_products
    Searchkick.reindex(self)
  end
  
  def update_vendor_stats
    vendor&.update_sales_stats
  end
end
