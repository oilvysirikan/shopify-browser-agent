FROM ruby:3.2.2

WORKDIR /app

RUN apt-get update -qq && apt-get install -y --no-install-recommends \
  build-essential \
  libpq-dev \
  nodejs \
  && rm -rf /var/lib/apt/lists/*

COPY Gemfile ./
RUN bundle install

COPY . .

EXPOSE 3000

CMD ["bash", "-lc", "bundle exec rails db:prepare && bundle exec rails s -b 0.0.0.0 -p ${PORT:-3000}"]
