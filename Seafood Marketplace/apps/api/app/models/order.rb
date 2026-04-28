class Order < ApplicationRecord
  # Associations
  belongs_to :customer, class_name: 'User', foreign_key: 'customer_id'
  has_many :order_items, dependent: :destroy
  has_many :products, through: :order_items
  has_many :vendors, -> { distinct }, through: :order_items
  has_many :payments, dependent: :destroy
  has_many :reviews, dependent: :nullify
  
  # Enums
  enum status: {
    pending: 'pending',
    confirmed: 'confirmed',
    preparing: 'preparing',
    ready: 'ready',
    delivering: 'delivering',
    completed: 'completed',
    cancelled: 'cancelled'
  }
  
  enum payment_status: {
    pending: 'pending',
    paid: 'paid',
    failed: 'failed',
    refunded: 'refunded',
    partially_refunded: 'partially_refunded'
  }
  
  enum payment_method: {
    promptpay: 'promptpay',
    credit_card: 'credit_card',
    cod: 'cod',
    bank_transfer: 'bank_transfer'
  }
  
  # Validations
  validates :order_number, presence: true, uniqueness: true
  validates :subtotal, :total_amount, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :delivery_fee, :discount_amount, numericality: { greater_than_or_equal_to: 0 }
  validates :payment_method, inclusion: { in: payment_methods.keys }
  
  # Callbacks
  before_validation :generate_order_number, on: :create
  before_validation :calculate_totals, on: :create
  before_save :update_status_timestamps
  after_commit :notify_status_change, if: :saved_change_to_status?
  after_commit :update_inventory, on: :create
  
  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :for_vendor, ->(vendor_id) { joins(:order_items).where(order_items: { vendor_id: vendor_id }).distinct }
  scope :for_customer, ->(customer_id) { where(customer_id: customer_id) }
  scope :completed, -> { where(status: :completed) }
  scope :pending_payment, -> { where(payment_status: :pending) }
  scope :pending_fulfillment, -> { where(status: [:confirmed, :preparing, :ready, :delivering]) }
  
  # Instance Methods
  def add_product(product, quantity: 1)
    order_item = order_items.find_or_initialize_by(product_id: product.id)
    order_item.quantity += quantity
    order_item.unit_price = product.price
    order_item.vendor_id = product.vendor_id
    order_item.product_name = product.name
    order_item.product_image_url = product.primary_image&.url
    order_item.sku = product.sku
    order_item.save!
    
    calculate_totals
    save!
  end
  
  def calculate_totals
    self.subtotal = order_items.sum('unit_price * quantity')
    self.total_amount = subtotal + delivery_fee - discount_amount
  end
  
  def mark_as_paid!(payment_method, payment_attributes = {})
    transaction do
      update!(
        payment_status: :paid,
        payment_method: payment_method,
        paid_at: Time.current
      )
      
      payments.create!(
        amount: total_amount,
        status: :completed,
        payment_method: payment_method,
        **payment_attributes
      )
      
      confirm! if pending?
    end
  end
  
  def cancel!(reason = nil, cancelled_by: 'system')
    transaction do
      update!(
        status: :cancelled,
        cancelled_at: Time.current,
        cancellation_reason: reason,
        cancelled_by: cancelled_by
      )
      
      # Restore inventory
      order_items.each do |item|
        item.product.increment!(:stock_quantity, item.quantity) if item.product.track_inventory?
      end
      
      # Process refund if paid
      if paid?
        # Implement refund logic here
        update!(payment_status: :refunded, refunded_at: Time.current)
      end
      
      # Notify customer and vendor
      notify_cancellation
    end
  end
  
  def complete_delivery!
    transaction do
      update!(
        status: :completed,
        completed_at: Time.current
      )
      
      # Update vendor stats
      vendors.each(&:update_sales_stats)
      
      # Generate vendor payouts
      generate_vendor_payouts
      
      # Request review
      request_review
    end
  end
  
  def tracking_url
    return nil unless tracking_number.present?
    
    case shipping_provider
    when 'kerry'
      "https://th.kerryexpress.com/th/track/?track=#{tracking_number}"
    when 'flash'
      "https://www.flashexpress.co.th/tracking/?trackingNumber=#{tracking_number}"
    else
      nil
    end
  end
  
  def formatted_status
    I18n.t("orders.statuses.#{status}")
  end
  
  def can_be_cancelled?
    !%w[completed cancelled].include?(status)
  end
  
  private
  
  def generate_order_number
    return if order_number.present?
    
    date_prefix = Time.current.strftime('%Y%m%d')
    last_order = Order.where("order_number LIKE ?", "ORD-#{date_prefix}-%").order(:id).last
    sequence = last_order ? last_order.order_number.split('-').last.to_i + 1 : 1
    
    self.order_number = "ORD-#{date_prefix}-#{format('%04d', sequence)}"
  end
  
  def update_status_timestamps
    if status_changed?
      case status.to_sym
      when :confirmed
        self.confirmed_at ||= Time.current
      when :completed
        self.completed_at ||= Time.current
      end
    end
  end
  
  def update_inventory
    order_items.each do |item|
      if item.product.track_inventory?
        item.product.decrement!(:stock_quantity, item.quantity)
        item.product.increment!(:total_sold, item.quantity)
      end
    end
  end
  
  def generate_vendor_payouts
    order_items.group_by(&:vendor_id).each do |vendor_id, items|
      vendor = Vendor.find(vendor_id)
      total_amount = items.sum(&:subtotal)
      commission = total_amount * (vendor.commission_rate / 100.0)
      
      Payout.create!(
        vendor: vendor,
        order: self,
        amount: total_amount - commission,
        status: :pending,
        payment_method: :bank_transfer,
        bank_name: vendor.bank_name,
        bank_account_number: vendor.bank_account_number,
        bank_account_name: vendor.bank_account_name
      )
    end
  end
  
  def notify_status_change
    OrderStatusNotificationJob.perform_later(self, status)
  end
  
  def notify_cancellation
    OrderCancellationNotificationJob.perform_later(self)
  end
  
  def request_review
    ReviewRequestJob.set(wait: 3.days).perform_later(id)
  end
end
