require 'active_support/core_ext/integer/time'

Rails.application.configure do
  config.cache_classes = true
  config.eager_load = true
  config.consider_all_requests_local = false
  config.action_controller.perform_caching = true

  config.force_ssl = ENV['FORCE_SSL'] == 'true'
  config.log_level = :info
  config.log_tags = [:request_id]

  config.active_storage.service = :local
  config.active_record.dump_schema_after_migration = false
end
