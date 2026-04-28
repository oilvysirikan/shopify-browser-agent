require 'active_support/core_ext/integer/time'

Rails.application.configure do
  config.cache_classes = true
  config.eager_load = ENV['CI'].present?

  config.consider_all_requests_local = true
  config.action_controller.perform_caching = false
  config.cache_store = :null_store

  config.active_storage.service = :test
  config.active_job.queue_adapter = :test

  config.action_dispatch.show_exceptions = false
  config.action_controller.allow_forgery_protection = false
end
