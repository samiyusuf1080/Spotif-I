/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var axios = require('axios');
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
const { constants } = require('buffer');

var client_id = '91e0d69f069c48ad864c1c933ec58f8f'; // Your client id
var client_secret = '1142dbe5632a4fac830fc3b3ff7c8c58'; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
 
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};


async function getGenreMap(option){
	let recentArtistGenres = new Map();
	await axios.request(option).then(function(response){
		const resp = response.data;
		let artistData = resp.items;
		for(i in artistData){
			let artistGenres = artistData[i].genres;
			//console.log(artistGenres);
			for(j in artistGenres){
				let genre = artistGenres[j];
				if(!recentArtistGenres.has(genre)){
					recentArtistGenres.set(genre, 1);
				}
				else{
					let currNum = recentArtistGenres.get(genre);
					currNum = currNum + 1;
					recentArtistGenres.set(genre, currNum);
				}
			}
		}
		
	}).catch(function(error){
		console.error(error);
	});
	return recentArtistGenres;
}


async function compareMaps(newGenres, oldGenres){
	diffMap = new Map();
	newGenres.forEach(function(value, key){
		let currGenre = key;
		let newCount = value;
		if(oldGenres.has(key)){
			let oldCount = oldGenres.get(currGenre);
			let diff = newCount - oldCount;
			diffMap.set(currGenre, diff)
		}
		else{
			diffMap.set(currGenre, newCount)
		}
	})
	oldGenres.forEach(function(value, key){
		if(!diffMap.has(key)){
			let diff = -1 * value
			diffMap.set(key, diff);
		}
	})
	
	moreFrequentGenres = [];
	lessFrequentGenres = [];
	
	diffMapSorted = new Map([...diffMap.entries()].sort((a, b) => b[1] - a[1]));
	return diffMapSorted;
	//console.log(diffMapSorted);
	
}

async function getGenres(genres){
	const topList = [];
	genres.forEach(function(value, key){
		topList.push(key);
	})
	return topList;
}
var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email user-library-read user-top-read';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;
        
        var options3 = {
    			url: 'https://api.spotify.com/v1/me/top/artists?offset=0&limit=20&time_range=short_term',
              headers: { 'Authorization': 'Bearer ' + access_token },
              json: true
    	}
        
        var options4 = {
    			url: 'https://api.spotify.com/v1/me/top/artists?offset=0&limit=20&time_range=long_term',
              headers: { 'Authorization': 'Bearer ' + access_token },
              json: true
    	}
        
        
        var recentArtistGenres = getGenreMap(options3);
        var overallArtistGenres = getGenreMap(options4);
        
        recentArtistGenres.then(function(result1){
        	//console.log("RECENT", result1);
        	overallArtistGenres.then(function(result2){
            	//console.log("All-Time", result2);
            	var diffGenres = compareMaps(result1, result2);
				diffGenres.then(function(result3){
					var genreList = getGenres(result3);
					genreList.then(function(result4){
						console.log("The new genres you have been listening to recently are", result4[0], ",", result4[1], ", and ", result4[2], ".");
						console.log("The genres that you listened to a lot before but not so much anymore are ", result4[result4.length-1], ", ", result4[result4.length-2], ", and ", result4[result4.length-3], ".");
					})
				})
            })
        })
        
        
        
        
        
        
			
        /*
		
		var options2 = {
			url: 'https://api.spotify.com/v1/me/top/tracks?offset=0&limit=50&time_range=long_term',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
		}
		
		let trackNames = [];
		const trackArtists = new Map();
		let artistIDs = [];
		let totalCount = 0;
		let artistEndpoint = "https://api.spotify.com/v1/artists?ids=";
		
		axios.request(options2).then(function(response){
			const resp = response.data;
			let trackData = resp.items;
			for(i in trackData){
				trackNames.push(trackData[i].name);
				let currArtist = trackData[i].artists;
				for(i in currArtist){
					artistIDs.push(currArtist[i].id);
					let artistName = currArtist[i].name;
					//console.log(artistName);
					if(!trackArtists.has(artistName)){
						trackArtists.set(artistName, 1);
					}
					else{
						let currNum = trackArtists.get(artistName);
						currNum = currNum + 1;
						trackArtists.set(artistName, currNum);
					}
				}
			}
			for(i in artistIDs){
				if(artistIDs.length-1 == i){
					artistEndpoint += artistIDs[i];
				}
				else{
					artistEndpoint += artistIDs[i] + "%";
				}
			}
			//console.log(artistEndpoint);
			
			
		}).catch(function(error){
			console.error(error);
		});
		
		
		
		
		
		
		
		let trackNamesShort = [];
		const trackArtistsShort = new Map();
		let artistIDsShort = [];
		var artistEndpointShort = "https://api.spotify.com/v1/artists?ids=";
		
		var options = {
          url: 'https://api.spotify.com/v1/me/top/tracks?offset=0&limit=50&time_range=short_term',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

		axios.request(options).then(function(response){
			const resp = response.data;
			let trackData = resp.items;
			//console.log(trackData);
			for(i in trackData){
				trackNamesShort.push(trackData[i].name);
				let currArtist = trackData[i].artists;
				for(i in currArtist){
					let artistName = currArtist[i].name;
					artistIDsShort.push(currArtist[i].id);
					if(!trackArtistsShort.has(artistName)){
						trackArtistsShort.set(artistName, 1);
					}
					else{
						let currNum = trackArtistsShort.get(artistName);
						currNum = currNum + 1;
						trackArtistsShort.set(artistName, currNum);
					}
				}
			}
			for(i in artistIDsShort){
				if(artistIDsShort.length-1 == i){
					artistEndpointShort += artistIDsShort[i];
				}
				else{
					artistEndpointShort += artistIDsShort[i] + "%";
				}
			}
			
			getGenres(access_token, artistEndpointShort);
			
		}).catch(function(error){
			console.error(error);
		});
		
		console.log(artistEndpointShort);
		*/
		
	/*
        // use the access token to access the Spotify Web API
		 request.get(options2, function(error, response, body) {
          //console.log(body);
		  console.log("ALBUM", album);
        });

		
        request.get(options, function(error, response, body) {
          console.log(body);
        });
	*/

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

console.log('Listening on 8888');
app.listen(8888);
