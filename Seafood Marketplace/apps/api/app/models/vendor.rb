class Vendor < ApplicationRecord
  # Associations
  belongs_to :user
  has_many :products, dependent: :destroy
  has_many :order_items, dependent: :nullify
  has_many :reviews, dependent: :destroy
  has_many :payouts, dependent: :destroy
  
  # Validations
  validates :store_name, presence: true
  validates :slug, presence: true, uniqueness: true, 
                  format: { with: /\A[a-z0-9\-]+\z/, 
                           message: "can only contain lowercase letters, numbers, and hyphens" }
  validates :phone, format: { with: /\A[0-9]{10,15}\z/, allow_blank: true }
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP, allow_blank: true }
  validates :commission_rate, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
  validates :min_order_amount, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :delivery_fee, numericality: { greater_than_or_equal_to: 0 }
  validates :delivery_radius_km, numericality: { only_integer: true, greater_than: 0 }
  
  # Enums
  enum status: { 
    pending: 'pending', 
    approved: 'approved', 
    suspended: 'suspended', 
    rejected: 'rejected' 
  }
  
  # Callbacks
  before_validation :generate_slug, on: :create
  before_save :normalize_phone
  after_save :update_user_status, if: :saved_change_to_status?
  
  # Scopes
  scope :active, -> { where(status: :approved) }
  scope :nearest_first, ->(lat, lng) {
    return unless lat.present? && lng.present?
    
    # Using the haversine formula for distance calculation in kilometers
    select("vendors.*, 
      (6371 * acos(cos(radians(#{lat})) * cos(radians(latitude)) * 
      cos(radians(longitude) - radians(#{lng})) + 
      sin(radians(#{lat})) * sin(radians(latitude)))) AS distance")
      .where("latitude IS NOT NULL AND longitude IS NOT NULL")
      .order("distance ASC")
  }
  
  # Instance Methods
  def full_address
    [address, district, province, postal_code, 'Thailand'].compact.join(', ')
  end
  
  def update_average_rating
    update_columns(
      average_rating: reviews.average(:overall_rating).to_f.round(2),
      total_reviews: reviews.count
    )
  end
  
  def update_sales_stats
    update_columns(
      total_orders: order_items.completed.count,
      total_sales: order_items.completed.sum('unit_price * quantity')
    )
  end
  
  def operating_hours_for(day)
    return nil unless operating_hours.present?
    operating_hours[day.to_s] || operating_hours[day.to_s.capitalize]
  end
  
  def is_open_now?
    return false unless approved?
    
    now = Time.current
    day = now.strftime('%A').downcase
    hours = operating_hours_for(day)
    
    return false unless hours.present? && hours['open'].present? && hours['close'].present?
    
    open_time = Time.zone.parse(hours['open'])
    close_time = Time.zone.parse(hours['close'])
    
    # Handle overnight hours (e.g., 18:00 to 02:00)
    if close_time < open_time
      now.seconds_since_midnight.between?(
        open_time.seconds_since_midnight, 
        1.day.to_i
      ) || now.seconds_since_midnight.between?(
        0, 
        close_time.seconds_since_midnight
      )
    else
      now.seconds_since_midnight.between?(
        open_time.seconds_since_midnight, 
        close_time.seconds_since_midnight
      )
    end
  end
  
  def available_delivery_slots(date = Date.current)
    return [] unless approved?
    
    day = date.strftime('%A').downcase
    hours = operating_hours_for(day)
    return [] unless hours.present? && hours['open'].present? && hours['close'].present?
    
    open_time = Time.zone.parse(hours['open'])
    close_time = Time.zone.parse(hours['close'])
    
    # Generate 1-hour slots
    slots = []
    current_slot = date.in_time_zone.beginning_of_day + open_time.seconds_since_midnight.seconds
    end_time = date.in_time_zone.beginning_of_day + close_time.seconds_since_midnight.seconds
    
    while current_slot + 1.hour <= end_time
      slots << {
        start_time: current_slot,
        end_time: current_slot + 1.hour,
        display: "#{current_slot.strftime('%H:%M')} - #{(current_slot + 1.hour).strftime('%H:%M')}"
      }
      current_slot += 1.hour
    end
    
    slots
  end
  
  private
  
  def generate_slug
    return if slug.present?
    
    base_slug = store_name.parameterize
    self.slug = base_slug
    
    # Handle duplicate slugs
    count = 1
    while Vendor.where(slug: self.slug).exists?
      self.slug = "#{base_slug}-#{count}"
      count += 1
    end
  end
  
  def normalize_phone
    self.phone = phone.gsub(/\D/, '') if phone.present?
  end
  
  def update_user_status
    if approved? && user.present?
      user.update!(status: :active)
    elsif (suspended? || rejected?) && user.present?
      user.update!(status: :suspended)
    end
  end
end
