# Standard Python Runtime
FROM python:3.11-slim
WORKDIR /workspace
RUN pip install --no-cache-dir \
      pytest \
      && rm -rf /root/.cache
RUN useradd -u 1000 -m sandbox
USER sandbox
