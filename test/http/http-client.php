<?php

// slightly modified version from
// http://www.php.net/manual/en/function.curl-multi-add-handle.php

//create the multiple cURL handle
$mh = curl_multi_init();

for ($i = 1; $i <= 10000; $i ++) {
	// create both cURL resources
	$ch1 = curl_init();

	// set URL and other appropriate options
	curl_setopt($ch1, CURLOPT_URL, "http://127.0.0.1:50088/");
	curl_setopt($ch1, CURLOPT_HEADER, 0);

	//add the two handles
	curl_multi_add_handle($mh,$ch1);
	
}

$running=null;
//execute the handles
do {
    curl_multi_exec ($mh, $running);
} while($running > 0);

//close all the handles
curl_multi_remove_handle($mh, $ch1);
curl_multi_remove_handle($mh, $ch2);
curl_multi_close($mh);
?>
