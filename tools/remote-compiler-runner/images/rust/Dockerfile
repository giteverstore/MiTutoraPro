FROM rust:1.98.1-slim-bookworm
COPY execute.sh /runner/execute
RUN chmod 0555 /runner/execute
ENTRYPOINT ["/runner/execute"]
