class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  has_secure_password
  
  # Enums
  enum role: { customer: 'customer', vendor: 'vendor', admin: 'admin' }
  enum status: { active: 'active', suspended: 'suspended', banned: 'banned' }
  
  # Validations
  validates :phone_number, presence: true, uniqueness: true,
                          format: { with: /\A[0-9]{10,15}\z/, message: "must be a valid phone number" }
  validates :email, presence: true, uniqueness: true, 
                   format: { with: URI::MailTo::EMAIL_REGEXP },
                   unless: -> { email.blank? }
  validates :password, length: { minimum: 8 }, if: -> { password.present? }
  validates :role, inclusion: { in: roles.keys }
  
  # Callbacks
  before_validation :normalize_phone_number
  before_create :set_default_role
  
  # Associations
  has_one :vendor, dependent: :destroy
  has_many :addresses, dependent: :destroy
  has_many :orders, foreign_key: 'customer_id', dependent: :nullify
  has_many :reviews, foreign_key: 'customer_id', dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_many :activity_logs, dependent: :destroy
  
  # Scopes
  scope :customers, -> { where(role: :customer) }
  scope :vendors, -> { where(role: :vendor) }
  scope :admins, -> { where(role: :admin) }
  scope :active, -> { where(status: :active) }
  
  # Instance Methods
  def full_name
    [first_name, last_name].compact.join(' ').presence || 'Anonymous'
  end
  
  def vendor?
    role == 'vendor'
  end
  
  def admin?
    role == 'admin'
  end
  
  def customer?
    role == 'customer'
  end
  
  def generate_auth_token
    payload = {
      user_id: id,
      role: role,
      exp: 24.hours.from_now.to_i
    }
    JWT.encode(payload, Rails.application.credentials.secret_key_base)
  end
  
  def self.from_token(token)
    decoded = JWT.decode(token, Rails.application.credentials.secret_key_base).first
    find(decoded['user_id'])
  rescue JWT::DecodeError, ActiveRecord::RecordNotFound
    nil
  end
  
  private
  
  def normalize_phone_number
    self.phone_number = phone_number.gsub(/\D/, '') if phone_number.present?
  end
  
  def set_default_role
    self.role ||= :customer
  end
end
