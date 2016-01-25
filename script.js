
/* contains all necessary DOM refernences */
var ui = {
	map: document.getElementById('map'),
	search: document.getElementById('event-search'),
	statusmsg: document.getElementById('status-message'),
	resultsBadge: document.getElementById('results-badge'),
	summary: document.getElementById('data-sum'),

	/* charts */
	capacity: document.getElementById('chart-capacity'),
	start: document.getElementById('chart-start'),
	duration: document.getElementById('chart-duration'),
	weekdays: document.getElementById('chart-weekdays'),
	categories: document.getElementById('chart-categories'),

	/* legends */
	weekdays_legend: document.getElementById('chart-weekdays-legend'),
	categories_legend: document.getElementById('chart-categories-legend'),

	/* spans */
	span_start: null,
	span_dur: null,
	span_cap: null,
	span_day: null,
	span_cats: null,
}

/* * * * * * * * * * * * * * * * * * * * * * * * */
/* DataContainer holds the event data for the queried location */
var DataContainer = function() {
	this.data = 'no_data';
}

DataContainer.prototype = {
	getData: function() {
		return this.data;
	},
	setData: function(newData, _refresh) {
		this.data = newData
		_refresh();
	},
}

/* * * * * * * * * * * * * * * * * * * * * * * * */
/* SearchModule handles everything search related */
var SearchModule = {

	search: function() {
		/* search, so long as something has been entered */
		if ( ui.search.value.replace(' ', '') !== '' ) {
			ui.search.placeholder = ui.search.value;
			DataRequestModule.getEventData(-1, ui.search.value);
		}
	},
};



/* * * * * * * * * * * * * * * * * * * * * * * * */
/* DataRequestModule handles the data requests */
var DataRequestModule = {

	getEventData: function(data, query) {
		if ( data === -1 ) {
			this.getRequest( query, this.getEventData);  
		}
		else {

			DataContainer.setData( JSON.parse(data) , DisplayModule.displayResults );
			//console.log( DataContainer.getData() );
		}
	}, 

	getRequest: function(path, _callback)
	{
		var xmlHttp = new XMLHttpRequest();
		xmlHttp.onreadystatechange = function() { 
 			if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
 				ui.statusmsg.innerHTML = '';
      			_callback(xmlHttp.responseText);
      		}
      		else {
      			DataRequestModule.loadingDataMessage(xmlHttp.readyState, xmlHttp.status);
      		}
		}
		xmlHttp.open("GET", 'http://127.0.0.1:5000/' + path, true); 
		xmlHttp.send(null);
	},

	locationNotFoundError: function() {
		ui.statusmsg.innerHTML = "Sorry, couldn't find that. <br />Make sure you've entered the name of a city.";
	},

	loadingDataMessage: function(state, status) {
		ui.statusmsg.innerHTML = 'Loading everything you want to see! ...';
		if (state === 4 && status !== 200) {
			DataRequestModule.locationNotFoundError();
		}
	},

}



/* * * * * * * * * * * * * * * * * * * * * * * * */
/* Helper functions */

/* returns string representation of the most day of the week
   containing the most events */
function popularDay(week) {
	var top = 0;

	var days = {
		0: 'Monday',
		1: 'Tuesday',
		2: 'Wednesday',
		3: 'Thursday',
		4: 'Friday',
		5: 'Saturday',
		6: 'Sunday',
	};

	for (day in week) {
		if ( week[day] >= week[top] ) {
			top = day;
		}
	}

	return days[top];
}

/* returns an array containing string representations of
   the top 3 categories by event volume */
function popularCats(cats) {

	return Object.keys(cats).sort( function(a, b) {
		return cats[b]-cats[a];
	}).splice(0, 3);
}

/* takes a decimal representation of a time in hours
   and returns a string representation of that time
   ie. 14.5 --> 2:30 PM */
function decimalToTimeString(dec) {

	var isPM = 0;
	var mins, hrs;

	hrs = dec.toFixed(0);
	if (hrs >= 12) {
		isPM = 1;
	} 
	hrs %= 12;

	mins = dec % 1;
	mins *= 60;
	mins = mins.toFixed(0);

	return hrs + ':' + mins + ' ' + ( isPM ? 'PM' : 'AM');
}

/* * * * * * * * * * * * * * * * * * * * * * * * */
/* MapModule handles the pretty map */
var MapModule = {

	map: null,
	
	cur_markers: null,

	 init: function() {
	 	L.mapbox.accessToken = 'pk.eyJ1IjoiYWxleGc0NzMiLCJhIjoiY2lmOGhvcTduMXhkdHM2bHpibGtweTN6NCJ9.vj9PrvIptfOskiEfxf8Z0g';
	 	MapModule.map = L.mapbox.map('map', 'mapbox.streets-basic');
	 	MapModule.map.zoomControl.removeFrom(MapModule.map);
	 	MapModule.map.tileLayer.setOpacity(0.4); // map is not as important as the layout of markers on top of it
	 }, 

	/* update the map with markers at each popular event location */
	updateMap: function(locs) {

		ui.map.style.height = '40%';

		/* clear the existing markers from the map */
		if ( MapModule.cur_markers ) {
			MapModule.map.removeLayer(MapModule.cur_markers);
		}

		/* set the map to the location of the popular event cluster */
		MapModule.map.setView([ locs[0]['lat'], locs[0]['lon'] ], 13);

		/* add the marker layer to the map */
		MapModule.cur_markers = L.mapbox.featureLayer().addTo(MapModule.map);

		/* create a marker for each of the popular event locations */
		locs.forEach( function(loc) {
			var mrkr = L.marker([ loc['lat'], loc['lon'] ], {
				 	   		icon: L.icon({
					   			iconUrl: 'assets/icon_popular.gif',
								iconRetinaUrl: 'assets/icon_popular_2x.gif',
								iconSize: [10, 10],
							}),
						});
			MapModule.cur_markers.addLayer(mrkr);
		});
	},

}

/* * * * * * * * * * * * * * * * * * * * * * * * */
/* Display Module handles all visual interactions */
var DisplayModule = {

	/* chart status represents whether chart has been loaded */
	/* 0 = not yet loaded; 1 = has been loaded */
	status: {
		'CUR_CHART': null, /* id of currently displayed chart */
		'capacity': 0,
		'start': 0,
		'duration': 0,
		'weekdays': 0,
		'categories': 0,
	},

	/* now that results have been recieved from out proxy,
	   let's display them to the user */
	displayResults: function(query) {

		var cur_data = DataContainer.getData();

		MapModule.updateMap( cur_data['locations'] );

		DisplayModule.displayResultsCount( cur_data['num_events'] );

		DisplayModule.generateSummary(cur_data['avg_start_time'], cur_data['avg_duration'], cur_data['avg_until'], 
			cur_data['avg_capacity'], popularDay( cur_data['day_frequency'] ), popularCats( cur_data['category_freq'] ));

		DisplayModule.scrollToChart('categories');

	},

	/* display the chart/graph corresponding to the metric that
	   the user click on from the text summary */
	scrollToChart: function(chart_id) {

		var cur_data = DataContainer.getData();
		/* load the charts as they are requested */
		switch ( chart_id ) {
			case 'capacity':
				if ( !DisplayModule.status['capacity'] ) {
					DisplayModule.buildHistogram( cur_data['arr_capacity'], 
									'Capacity',
									'#chart-capacity', 10, [0, 1000]);
					DisplayModule.status['capacity'] = 1;
				}
				break;

			case 'start':
				if ( !DisplayModule.status['start'] ) {
					DisplayModule.buildHistogram( cur_data['arr_start_time'], 
									'Start Time',
									'#chart-start', 25);
					DisplayModule.status['start'] = 1;
				}
				break;

			case 'duration':
				if ( !DisplayModule.status['duration'] ) {
					DisplayModule.buildHistogram( cur_data['arr_duration'], 
									'Duration (hrs)',
									'#chart-duration', 8, [0, 50]);
					DisplayModule.status['duration'] = 1;
				}
				break;
			case 'weekdays':
				if ( !DisplayModule.status['weekdays'] ) {
					var raw = cur_data['day_frequency'];
					DisplayModule.buildPieChart( [
			          { label: 'Monday', count: raw['0'] }, 
			          { label: 'Tuesday', count: raw['1'] },
			          { label: 'Wednesday', count: raw['2'] },
			          { label: 'Thursday', count: raw['3'] },
			          { label: 'Friday', count: raw['4'] },
			          { label: 'Saturday', count: raw['5'] },
			          { label: 'Sunday', count: raw['6'] }
        			], '#chart-weekdays', '#chart-weekdays-legend' );
					DisplayModule.status['weekdays'] = 1;
				}
				ui[ 'weekdays_legend' ].classList.remove('no-vis');
				break;
			case 'categories':
				if ( !DisplayModule.status['categories'] ) {
					var raw = cur_data['category_freq'];
					DisplayModule.buildPieChart( [
			          { label: 'Arts', count: raw['Arts'] }, 
			          { label: 'Business', count: raw['Business'] },
			          { label: 'Charity & Causes', count: raw['Charity & Causes'] },
			          { label: 'Community', count: raw['Community'] },
			          { label: 'Film & Media', count: raw['Film & Media'] },
			          { label: 'Food & Drink', count: raw['Food & Drink'] },
			          { label: 'Government', count: raw['Government'] },
			          { label: 'Health', count: raw['Health'] },
			          { label: 'Music', count: raw['Music'] },
			          { label: 'Science & Tech', count: raw['Science & Tech'] },
			          { label: 'Travel & Outdoor', count: raw['Travel & Outdoor'] },
			          { label: 'Other', count: raw['Other'] },
					  { label: 'None', count: raw['None'] },
			        ], '#chart-categories', '#chart-categories-legend' );
					DisplayModule.status['categories'] = 1;
				}
				ui[ 'categories_legend' ].classList.remove('no-vis');
				break;
			default:
				console.log("Error: requested chart does not exist.")
		}

		/* display chart */
		ui[ chart_id ].classList.remove('no-vis');

		/* hide current chart/legend, if necessary */
		if ( DisplayModule.status.CUR_CHART != chart_id && DisplayModule.status.CUR_CHART !== null ) {
			ui[ DisplayModule.status.CUR_CHART ].classList.add('no-vis');
		    if (DisplayModule.status.CUR_CHART == 'weekdays') {
		 		ui[ 'weekdays_legend' ].classList.add('no-vis');
		 	} 
		 	else if (DisplayModule.status.CUR_CHART == 'categories') {
		 		ui[ 'categories_legend' ].classList.add('no-vis');
		 	}
		}

		DisplayModule.status.CUR_CHART = chart_id;
	},

	/* display the number of popular events being analyzed, 
	   as a badge layered on top of the map */
	displayResultsCount: function(num) {
		ui.resultsBadge.style.visibility = 'visible';
		ui.resultsBadge.children[0].innerHTML = num;
	},

	/* display a textual summary of event statistics */
	generateSummary: function(avg_start, avg_dur, avg_until, avg_cap, pop_day, pop_cats) {

		/* wall of text that looks much better styled */
		ui[ 'summary' ].innerHTML = 'The average popular event in ' + ui.search.value.toUpperCase() + 
			' begins at <span id="span_start" class="sum-span" >' + decimalToTimeString(avg_start) + 
			'</span>, is <span id="span_dur" class="sum-span" >' + avg_dur.toFixed(1) + 
			'</span> hours long, and takes place on a <span id="span_day" class="sum-span" >' + pop_day + '.</span><br /><br />' +
			'Popular event categories include <span id="span_cats" class="sum-span">' + 
			pop_cats[0] + ', ' + pop_cats[1] + ', and ' + pop_cats[2] + '.</span><br /><br />' +
			'Most events are quite large, with a capacity averaging <span id="span_cap" class="sum-span">' + avg_cap + ' people.</span><br /><br />' +
			'Events are well planned in this area, posted to Eventbrite an average of ' + 
			avg_until.toFixed(0) + ' days before they take place.';

		/* summary span DOM references, because we just created them */
		span_start = document.getElementById('span_start');
		span_dur = document.getElementById('span_dur');
		span_cap = document.getElementById('span_cap');

		/* add the event listeners for the summary spans */
		span_start.addEventListener('click', function() {
			DisplayModule.scrollToChart('start');
		});

		span_dur.addEventListener('click', function() {
			DisplayModule.scrollToChart('duration');
		});

		span_cap.addEventListener('click', function() {
			DisplayModule.scrollToChart('capacity');
		});

		span_day.addEventListener('click', function() {
			DisplayModule.scrollToChart('weekdays');
		});

		span_cats.addEventListener('click', function() {
			DisplayModule.scrollToChart('categories');
		});

		ui[ 'summary' ].classList.remove('no-vis');
	},

	/* display a histogram of provided data */
	buildHistogram: function(raw, x_label, id, bins, bounds) {

		var data = raw.map( function(el) {
		 	return parseInt(el);
		});

		if ( bounds ) {
			data = data.filter( function(el) {
				return ( el >= bounds[0] && el <= bounds[1]);
			});
		}

		var w = 500;
		var h = 400;

		var formatCount = d3.format(",.0f");

		var margin = {top: 40, right: 30, bottom: 50, left: 30},
		    width = w - margin.left - margin.right,
		    height = h - margin.top - margin.bottom;

		var max = Number( d3.max(data) ) + 1;

		var x = d3.scale.linear()
		    .domain([0, max])
		    .range([0, width]);

		var data = d3.layout.histogram()
		      .bins(x.ticks(bins))
		      (data);  

		var y = d3.scale.linear()
		    .domain([0, d3.max(data, function(d) { return d.y; })])
		    .range([height, 0]);

		var xAxis = d3.svg.axis()
		    .scale(x)
		    .ticks(bins)
		    .orient("bottom");

		var svg = d3.select( id ).append("svg")
		    .attr("width", width + margin.left + margin.right)
		    .attr("height", height + margin.top + margin.bottom)
		    .append("g")
		    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		var bar = svg.selectAll(".bar")
		    .data(data)
		    .enter().append("g")
		    .attr("class", "bar")
		    .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; });

		bar.append("rect")
		    .attr("x", 1)
		    .attr("width", x(data[0].dx) - 1)
		    .attr("height", function(d) { return height - y(d.y); })

		bar.append("text")
		    .attr("dy", ".75em")
		    .attr("y", -15)
		    .attr("x", x(data[0].dx) / 2)
		    .attr("text-anchor", "middle")
		    .attr("style","fill:black")
		    .style("font-size","10px")
		    .text(function(d) { return formatCount(d.y); });

		svg.append("g")
		    .attr("class", "x axis")
		    .attr("transform", "translate(0," + height + ")")
		    .call(xAxis);

		//draw the axis labels
		svg.append("text")
		            .attr("text-anchor", "middle")
		            .attr("class", "black")
		            .attr("transform", "translate(" + (width / 2) + "," + (height + 40) + ")") 
		            .text(x_label);

		svg.append("text")
		            .attr("text-anchor", "middle")
		            .attr("class", "black")
		            .attr("transform", "translate(" + (-10) + "," + (height / 2) + ")rotate(-90)")
		            .text('# of Events');

	}, 

	/* display a pie chart of the provided data */
	buildPieChart: function(dataset, el, legend) {

		var dataset = dataset.map( function(el) {
		 	return { label: el.label, count: el.count ? el.count : 0 };
		});

		var legend_size = 18;
		var legend_spacing = 4;

        var width = 350

        var color = ( dataset.length > 7 ? 
        	d3.scale.category20c() : 
        	d3.scale.ordinal().range(['#0f293d', '#1a4466', '#24608f', '#2e7bb7', '#4894d1', '#70acdb', '#99c4e5']) ); 

        var svg = d3.select(el)
          .append('svg')
          .attr('width', width)
          .attr('height', width + 40)
          .append('g')
          .attr('transform', 'translate(' + (width / 2) + 
            ',' + ((width / 2) + 40) + ')');

        var arc = d3.svg.arc()
          .outerRadius(width / 2);

        var pie = d3.layout.pie()
          .value(function(d) { return d.count; })
          .sort(null);

        var path = svg.selectAll('path')
          .data(pie(dataset))
          .enter()
          .append('path')
          .attr('d', arc)
          .attr('fill', function(d, i) { 
            return color(d.data.label);
          });

        var svg_legend = d3.select(legend)
          .append('svg')
          .attr('width', 120)
          .attr('height', 350)
          .append('g')
          .attr('transform', 'translate(' + 0 + ',' + 175 + ')');

         var legend = svg_legend.selectAll('.legend')
			.data(color.domain())
			.enter()
			.append('g')
			.attr('class', 'legend')
			.attr('transform', function(d, i) {
			var height = legend_size + legend_spacing;
			var offset =  height * color.domain().length / 2;
			var horz = 0
			var vert = i * height - offset;
			return 'translate(' + horz + ',' + vert + ')';
		});

		legend.append('rect')
		  .attr('width', legend_size)
		  .attr('height', legend_size)
		  .style('fill', color)
		  .style('stroke', color);

		legend.append('text')
		  .attr('x', legend_size + legend_spacing)
		  .attr('y', legend_size - legend_spacing)
		  .text(function(d) { return d; });

	},
}

/* APPLICATION INIT */
var DataContainer = new DataContainer();
MapModule.init();
