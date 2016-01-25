from config import config
import requests, json
from datetime import datetime, timedelta, time, date
from flask import Flask, request, Response
from flask.ext.cors import CORS, cross_origin

app = Flask(__name__)

# CORS Handling
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'

# index route, no function other than making sure proxy is functioning
@app.route("/")
def proxy():
    return "This is not the page you are looking for."

# return data on events in provided location
@app.route("/<location>", methods = ['GET'])
@cross_origin()
def data(location):

	#define 30 days from now (for request parameter)
	thirty_days = date.today() + timedelta(days=30)
	thirty_days = thirty_days.strftime('%Y-%m-%dT%H:%M:%SZ')

	# request: return the 'best' popular events in the provided location happening in the next 30 days
	# expansions: include the category and venue with each returned event
	api_resp = requests.get('https://www.eventbriteapi.com/v3/events/search/?popular=yes&venue.city=' + location + '&start_date.range_end=' + thirty_days + '&sort_by=best&expand=category,venue&token=' + config['eb_token'])
	api_json = api_resp.json()

	print api_json
	
	return_data = {}
	return_data['locations'] = []
	return_data['num_events'] = 0
	return_data['arr_capacity'] = []
	return_data['avg_capacity'] = 0
	return_data['avg_duration'] = 0
	return_data['arr_start_time'] = []
	return_data['avg_start_time'] = 0
	return_data['arr_duration'] = []
	return_data['avg_until'] = 0
	return_data['category_freq'] = {}
	return_data['day_frequency'] = {
		'0': 0,
		'1': 0,
		'2': 0,
		'3': 0,
		'4': 0,
		'5': 0,
		'6': 0
	}

	popular_events = api_json['events']
	for event in popular_events: #loop through each of the returned events
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
		event_created = datetime.strptime(event['created'], '%Y-%m-%dT%H:%M:%SZ')
		day_begin = event_start.replace(hour=0, minute=0, second=0)

		# day frequency
		return_data['day_frequency'][ str(event_start.weekday()) ] += 1 

		# # start time (in hours)
		return_data['avg_start_time'] += ( ( event_start - day_begin ).total_seconds() / 3600 )
		return_data['arr_start_time'].append(( event_start - day_begin ).total_seconds() / 3600 )

		# duration (in hours)
		if ( ( event_end - event_start ).total_seconds() / 3600 ) < 50:
			return_data['avg_duration'] += ( ( event_end - event_start ).total_seconds() / 3600 )
			return_data['arr_duration'].append(( event_end - event_start ).total_seconds() / 3600 )

		# time until (in days)
		return_data['avg_until'] += ( ( event_start - event_created ).total_seconds() / ( 3600 * 24 ) )

		# capacity
		if event['capacity'] < 1000:
			return_data['avg_capacity'] += event['capacity']
			return_data['arr_capacity'].append(event['capacity'])

		# location
		return_data['locations'].append( { 'lat': event['venue']['latitude'], 'lon': event['venue']['longitude'] } )

	# finish average calculations
	return_data['avg_start_time'] /= len(return_data['arr_start_time'])
	return_data['avg_duration'] /= len(return_data['arr_duration'])
	return_data['avg_until'] /= return_data['num_events']
	return_data['avg_capacity'] /= len(return_data['arr_capacity'])

	# clear out non-categorized event counts 
	return_data['category_freq'][ 'None' ] = 0

	# return the data to javascript 
	return_data = json.dumps(return_data)
	resp = Response(return_data, status=200, mimetype='application/json')
	resp.headers['Access-Control-Allow-Origin'] = "*"
	return resp

# CORS Handling
@app.after_request
def after_request(response):
	response.headers['Access-Control-Allow-Origin'] = "*"
	response.headers['Access-Control-Allow-Headers'] = "origin, x-requested-with, content-type"
	response.headers['Access-Control-Allow-Methods'] = "PUT, GET, POST, DELETE, OPTIONS"
	return response

if __name__ == "__main__":
	app.run(debug=True)

