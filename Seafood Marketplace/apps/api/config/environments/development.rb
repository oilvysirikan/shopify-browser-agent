require 'active_support/core_ext/integer/time'

Rails.application.configure do
  config.cache_classes = false
  config.eager_load = false
  config.consider_all_requests_local = true

  config.action_controller.perform_caching = false
  config.cache_store = :null_store

  config.active_storage.service = :local
  config.active_record.migration_error = :page_load
  config.active_record.verbose_query_logs = true

  config.log_level = :debug
end
