class SyncLog < ApplicationRecord
  validates :platform, presence: true

  scope :recent, -> { order(created_at: :desc).limit(100) }
  scope :failed, -> { where(status: 'failed') }
end
