"""Immutable CPython 3.14 guest harness. Expected values never enter this process."""

import contextlib
import importlib.util
import io
import json
import pathlib
import sys

MAX_FRAME_BYTES = 64 * 1024
MAX_CAPTURE_CHARS = 64 * 1024


class BoundedSink(io.StringIO):
    def write(self, value):
        if self.tell() + len(value) > MAX_CAPTURE_CHARS:
            raise OverflowError("output limit")
        return super().write(value)


def emit(status, *, value=None, code=None):
    frame = {"schemaVersion": 1, "status": status}
    if status == "OK":
        frame["value"] = value
    if code:
        frame["code"] = code
    encoded = json.dumps(frame, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    if len(encoded) > MAX_FRAME_BYTES:
        encoded = b'{"schemaVersion":1,"status":"OUTPUT_LIMIT","code":"guest/output-limit"}'
    output = pathlib.Path("/work/output.json")
    with output.open("r+b", buffering=0) as result_file:
        result_file.seek(0)
        result_file.write(encoded)
        result_file.truncate()


def main():
    raw = pathlib.Path("/work/input.json").read_bytes()
    if len(raw) > (2 * MAX_FRAME_BYTES):
        emit("RUNTIME_ERROR", code="guest/invalid-input")
        return
    frame = json.loads(raw)
    pathlib.Path("/work/submission.py").write_text(frame["sourceCode"], encoding="utf-8")
    spec = importlib.util.spec_from_file_location("submission", "/work/submission.py")
    module = importlib.util.module_from_spec(spec)
    sink = BoundedSink()
    with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
        spec.loader.exec_module(module)
        function = getattr(module, frame["entryPoint"])
        result = function(*frame["arguments"])
    emit("OK", value=result)


if __name__ == "__main__":
    try:
        main()
    except SyntaxError:
        emit("SYNTAX_ERROR", code="guest/syntax-error")
    except MemoryError:
        emit("MEMORY_LIMIT", code="guest/memory-limit")
    except BlockingIOError:
        emit("PID_LIMIT", code="guest/pid-limit")
    except OverflowError:
        emit("OUTPUT_LIMIT", code="guest/output-limit")
    except OSError as error:
        if error.errno == 28:
            emit("DISK_LIMIT", code="guest/disk-limit")
        elif error.errno == 11:
            emit("PID_LIMIT", code="guest/pid-limit")
        elif error.errno == 24:
            emit("FD_LIMIT", code="guest/fd-limit")
        else:
            emit("RUNTIME_ERROR", code="guest/runtime-error")
    except BaseException:
        emit("RUNTIME_ERROR", code="guest/runtime-error")
