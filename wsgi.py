from flask import Flask, send_file
from threading import Thread

app = Flask('n')

def run():
  app.run(host="0.0.0.0", port=2347) 

def start():
  t = Thread(target=run)
  t.start()

@app.route("/")
def home():
  return "hello"


@app.route("/MeowFont.otf")
def font():
  return send_file('./MeowFont.otf', download_name='MeowFont.otf')

@app.route("/MFGoman.otf")
def goman():
  return send_file('./MFGoman.otf', download_name='MFGoman.otf')
  
@app.route("/MFCorodenian.otf")
def corodenian():
  return send_file('./MFCorodenian.otf', download_name='MFCorodenian.otf')
