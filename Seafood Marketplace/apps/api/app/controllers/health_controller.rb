require 'net/http'
require 'uri'

class HealthController < ApplicationController
  def index
    render json: {
      status: 'ok',
      timestamp: Time.current,
      services: {
        database: database_status,
        redis: redis_status,
        worker: worker_status
      }
    }
  end

  private

  def database_status
    ActiveRecord::Base.connection.active? ? 'connected' : 'disconnected'
  rescue StandardError
    'disconnected'
  end

  def redis_status
    Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/0')).ping == 'PONG' ? 'connected' : 'disconnected'
  rescue StandardError
    'disconnected'
  end

  def worker_status
    worker_url = ENV.fetch('FACEBOOK_WORKER_URL', 'http://localhost:4000')
    uri = URI.parse("#{worker_url}/health")

    response = Net::HTTP.get_response(uri)
    response.is_a?(Net::HTTPSuccess) ? 'running' : 'down'
  rescue StandardError
    'down'
  end
end
