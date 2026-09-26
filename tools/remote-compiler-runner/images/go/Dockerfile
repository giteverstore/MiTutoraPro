FROM golang:1.27.1-bookworm
COPY execute.sh /runner/execute
RUN chmod 0555 /runner/execute \
    && mkdir -p /opt/ycoders-go-cache \
    && GOCACHE=/opt/ycoders-go-cache CGO_ENABLED=0 go install bufio encoding/json fmt net net/http os os/exec regexp runtime sort sync time \
    && chmod -R a=rX /opt/ycoders-go-cache
ENTRYPOINT ["/runner/execute"]
