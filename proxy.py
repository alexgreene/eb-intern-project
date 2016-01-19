from config import config
import requests, json
from datetime import datetime, timedelta, time, date
from flask import Flask, request, Response

app = Flask(__name__)

@app.route("/")
def proxy():
    return "This is not the page you are looking for."

@app.route("/<location>", methods = ['GET'])
def purchase(location):

	thirty_days = date.today() + timedelta(days=30)
	thirty_days = thirty_days.strftime('%Y-%m-%dT%H:%M:%SZ')
	popular_events = requests.get('https://www.eventbriteapi.com/v3/events/search/?popular=yes&venue.city=' + location + '&expand=category&token=' + config['token'])
	popular_events = popular_events.json()
	popular_events = popular_events['events']

	return_data = {}
	return_data['num_events'] = 0
	return_data['avg_start_time'] = 0
	return_data['avg_duration'] = 0
	return_data['avg_until'] = 0
	return_data['day_frequency'] = {
		'0': 0,
		'1': 0,
		'2': 0,
		'3': 0,
		'4': 0,
		'5': 0,
		'6': 0
	}
	return_data['category_freq'] = {}

	for event in popular_events:
		# count
		return_data['num_events'] += 1

		# category frequency
		if event['category'] is not None:
			cat = event['category']['short_name']
		else:
			cat = 'None'

		if cat not in return_data['category_freq']:
			return_data['category_freq'][ cat ] = 0
		else:
			return_data['category_freq'][ cat ] += 1

		event_start = datetime.strptime(event['start']['local'], '%Y-%m-%dT%H:%M:%S')
		event_end = datetime.strptime(event['end']['local'], '%Y-%m-%dT%H:%M:%S')
		event_created = datetime.strptime(event['created'], '%Y-%m-%dT%H:%M:%S')

		# day frequency
		return_data['day_frequency'][ str(event_start.weekday()) ] += 1 

		# start time (in hours)
		return_data['avg_start'] += ( event_start.hour + event_start.minute / 60 + event_start.second / 3600 )

		# duration (in hours)
		return_data['avg_duration'] += ( ( event_end - event_start ).total_seconds() / 3600 )

		# time until (in hours)
		return_data['avg_until'] += ( ( event_start - event_created ).total_seconds() / 3600 )
		
	resp = Response(return_data, status=200, mimetype='application/json')
	resp.headers['Access-Control-Allow-Origin'] = "*"

	return resp

@app.after_request
def after_request(response):
	response.headers['Access-Control-Allow-Origin'] = "*"
	response.headers['Access-Control-Allow-Headers'] = "origin, x-requested-with, content-type"
	response.headers['Access-Control-Allow-Methods'] = "PUT, GET, POST, DELETE, OPTIONS"
	return response

if __name__ == "__main__":
	app.run()

