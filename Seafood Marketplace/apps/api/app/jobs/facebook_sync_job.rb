require 'net/http'
require 'uri'
require 'json'

class FacebookSyncJob < ApplicationJob
  queue_as :default

  def perform(product_ids_or_payload)
    products = normalize_products(product_ids_or_payload)

    worker_url = ENV.fetch('FACEBOOK_WORKER_URL', 'http://host.docker.internal:4000')
    uri = URI.parse("#{worker_url}/sync/facebook")

    request = Net::HTTP::Post.new(uri)
    request['Content-Type'] = 'application/json'
    request['X-Worker-Token'] = ENV['WORKER_SHARED_TOKEN'].to_s
    request.body = {
      products: products,
      catalogId: ENV['FACEBOOK_CATALOG_ID']
    }.to_json

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == 'https'
    response = http.request(request)

    if response.is_a?(Net::HTTPSuccess)
      Rails.logger.info("Facebook sync completed: #{response.body}")
    else
      Rails.logger.error("Facebook sync failed: #{response.code} #{response.body}")
      raise 'Facebook sync failed'
    end
  end

  private

  def normalize_products(input)
    return input if input.is_a?(Array) && input.first.is_a?(Hash)

    ids = Array(input)
    return [] if ids.empty?

    Product.where(id: ids).map do |product|
      {
        id: product.id,
        shopify_id: safe_read(product, :shopify_id) || product.id,
        title: safe_read(product, :name) || safe_read(product, :title),
        description: safe_read(product, :description),
        handle: safe_read(product, :handle) || product.id.to_s,
        variants: extract_variants(product),
        images: extract_images(product)
      }
    end
  rescue StandardError => e
    Rails.logger.warn("Product lookup skipped in FacebookSyncJob: #{e.message}")
    []
  end

  def extract_variants(product)
    return [] unless product.respond_to?(:product_variants)

    product.product_variants.map do |variant|
      {
        id: variant.id,
        price: safe_read(variant, :price),
        inventory_quantity: safe_read(variant, :quantity)
      }
    end
  rescue StandardError
    []
  end

  def extract_images(product)
    return [] unless product.respond_to?(:product_images)

    product.product_images.map do |img|
      {
        src: safe_read(img, :image)
      }
    end
  rescue StandardError
    []
  end

  def safe_read(record, attribute)
    record.public_send(attribute) if record.respond_to?(attribute)
  end
end
