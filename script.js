var search = document.getElementById('Event_Search');

/* * * * * * * * * * * * * * * * * * * * * * * * */
/* DataContainer holds the event data for the queried location */
var DataContainer = function() {
	data = '';
}

DataContainer.prototype = {
	getData: function() {
		return data;
	},
	setData: function(newData) {
		data = newData
	},
}

var DataContainer = new DataContainer();


/* * * * * * * * * * * * * * * * * * * * * * * * */
/* SearchModule handles everything search related */
var SearchModule = {

	search: function() {
		//console.log( 'SEARCH:' + sm_vars.searchInput.value );
		search.placeholder = search.value;
		DisplayModule.displayResults( search.value );
	},
};


/* * * * * * * * * * * * * * * * * * * * * * * * */
/* DataRequestModule handles the data requests */
var DataRequestModule = {

	getEventData: function(data, query) {
		if ( data === -1 ) {
			this.getRequest('/' + query, this.getEventData);
		}
		else {
			DataContainer.setData(data);
		}
	}, 

	getRequest: function(path, callback)
	{
		var xmlHttp = new XMLHttpRequest();
		xmlHttp.onreadystatechange = function() { 
 			if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
      			callback(xmlHttp.responseText);
      		}
		}
		xmlHttp.open("GET", 'http://127.0.0.1:5000' + path, true); 
		xmlHttp.send(null);
	},
}

var DisplayModule = {

	displayResults: function(query) {

		DataRequestModule.getEventData(-1, query);

		// console.log( DataContainer.getData() );

		this.displayChartA();
		this.displayChartB();
		this.displayChartC();
	},

	displayChartA: function() {

	}, 

	displayChartB: function() {

	},

	displayChartC: function() {

	},
}

