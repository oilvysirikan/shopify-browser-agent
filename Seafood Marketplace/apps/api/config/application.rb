require_relative 'boot'

require 'rails'
require 'active_model/railtie'
require 'active_job/railtie'
require 'active_record/railtie'
require 'active_storage/engine'
require 'action_controller/railtie'
require 'action_mailer/railtie'
require 'action_view/railtie'
require 'action_cable/engine'

Bundler.require(*Rails.groups)

module MarketplaceApi
  class Application < Rails::Application
    config.load_defaults 6.1
    config.api_only = true

    config.time_zone = 'Bangkok'
    config.active_record.default_timezone = :local

    config.active_job.queue_adapter = ENV.fetch('ACTIVE_JOB_QUEUE_ADAPTER', 'sidekiq').to_sym

    config.filter_parameters += %i[password password_confirmation credit_card]
  end
end
