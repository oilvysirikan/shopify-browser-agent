class ApplicationController < ActionController::API
  private

  def authenticate_worker!
    expected = ENV['WORKER_SHARED_TOKEN'].to_s
    provided = request.headers['X-Worker-Token'].to_s

    if expected.blank?
      return render json: { error: 'Server missing WORKER_SHARED_TOKEN' }, status: :internal_server_error
    end

    unless secure_compare(expected, provided)
      render json: { error: 'Unauthorized worker call' }, status: :unauthorized
    end
  end

  def ensure_webhook_verified!
    verified = request.headers['X-Webhook-Verified'].to_s
    return if verified == 'true'

    render json: { error: 'Unverified webhook source' }, status: :unauthorized
  end

  def secure_compare(expected, provided)
    return false if expected.blank? || provided.blank?
    return false unless expected.bytesize == provided.bytesize

    ActiveSupport::SecurityUtils.secure_compare(expected, provided)
  end
end
