$ErrorActionPreference = 'Stop'
docker build --pull --tag ycoders/go-runner:1.27.1 "$PSScriptRoot/images/go"
docker build --pull --tag ycoders/rust-runner:1.98.1 "$PSScriptRoot/images/rust"
