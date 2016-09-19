
function existsData (data)
{
	return ( data != undefined && data != null && data != "")
}

exports.dataIsFilled = function (data)
{
	return existsData (data);
}

exports.getCountry = function (shopifyInfo)
{
	if ( existsData (shopifyInfo.billing_address) && existsData (shopifyInfo.billing_address.country))
		return shopifyInfo.billing_address.country;
	if ((existsData (shopifyInfo.customer)) && (existsData (shopifyInfo.customer.default_address)) && (existsData (shopifyInfo.customer.default_address.country )))
		return shopifyInfo.customer.default_address.country;

	return undefined;
}

exports.getZip = function (shopifyInfo)
{
	if (existsData (shopifyInfo.billing_address) && existsData (shopifyInfo.billing_address.zip))
		return shopifyInfo.billing_address.zip;
	if ((existsData (shopifyInfo.customer)) && (existsData (shopifyInfo.customer.default_address)) && (existsData (shopifyInfo.customer.default_address.zip )))
		return shopifyInfo.customer.default_address.zip;

	return undefined;
}

exports.getProvince_code = function (shopifyInfo)
{
	if ( existsData (shopifyInfo.billing_address) && existsData (shopifyInfo.billing_address.province_code))
		return shopifyInfo.billing_address.province_code;
	if ((existsData (shopifyInfo.customer)) && (existsData (shopifyInfo.customer.default_address)) && (existsData (shopifyInfo.customer.default_address.province_code )))
		return shopifyInfo.customer.default_address.province_code;
	return undefined;
}


exports.getCity = function (shopifyInfo)
{
	if ( existsData (shopifyInfo.billing_address) && existsData (shopifyInfo.billing_address.city))
		return shopifyInfo.billing_address.city;
	if ((existsData (shopifyInfo.customer)) && (existsData (shopifyInfo.customer.default_address)) && (existsData (shopifyInfo.customer.default_address.city )))
		return shopifyInfo.customer.default_address.city;
	return undefined;
}


exports.getPhone = function (shopifyInfo)
{
	if ( existsData (shopifyInfo.billing_address) && existsData (shopifyInfo.billing_address.phone))
		return shopifyInfo.billing_address.phone;
	if ((existsData (shopifyInfo.customer)) && (existsData (shopifyInfo.customer.default_address)) && (existsData (shopifyInfo.customer.default_address.phone )))
		return shopifyInfo.customer.default_address.phone;
	return undefined;
}

exports.getCompany = function (shopifyInfo)
{
	if ( existsData (shopifyInfo.billing_address) && existsData (shopifyInfo.billing_address.company))
		return shopifyInfo.billing_address.company;
	if ((existsData (shopifyInfo.customer)) && (existsData (shopifyInfo.customer.default_address)) && (existsData (shopifyInfo.customer.default_address.company )))
		return shopifyInfo.customer.default_address.company ;
	return undefined;
}

exports.getAddress1 = function (shopifyInfo)
{
	var retAddr = ""
	if ( existsData (shopifyInfo.billing_address) && existsData (shopifyInfo.billing_address.address1))
		retAddr += shopifyInfo.billing_address.address1 + " " + shopifyInfo.billing_address.address2;
	return retAddr;
}

exports.getCustomeremail = function (shopifyInfo)
{
	if ( existsData (shopifyInfo.customer))
		if (existsData (shopifyInfo.customer.email))
			return shopifyInfo.customer.email
	if ( existsData (shopifyInfo.email))
		return shopifyInfo.email;
	if ( existsData (shopifyInfo.contact_email))
		return shopifyInfo.contact_email;
	return undefined
}

exports.getCustomerName = function (shopifyInfo)
{
	// FROM CUSTOMER
	if ( existsData (shopifyInfo.customer)) {
		if ( existsData (shopifyInfo.customer.name))
			return shopifyInfo.customer.name;
		else
			if ( existsData (shopifyInfo.customer.first_name) && existsData (shopifyInfo.customer.last_name))
				return shopifyInfo.customer.first_name + " " + shopifyInfo.customer.last_name
		

		if ( existsData (shopifyInfo.customer.default_address))
		{
			if ( existsData (shopifyInfo.customer.default_address.name))
				return shopifyInfo.customer.default_address.name;
			else
				if ( existsData (shopifyInfo.customer.default_address.first_name) && existsData (shopifyInfo.customer.default_address.last_name))
					return shopifyInfo.customer.default_address.first_name + " " + shopifyInfo.customer.default_address.last_name
		}
		
	}
	// FROM BILLING ADDRESS
	if ( existsData (shopifyInfo.billing_address))
	{
		if ( existsData (shopifyInfo.billing_address.name))
			return shopifyInfo.billing_address.name;
		else
			if ( existsData (shopifyInfo.billing_address.first_name) && existsData (shopifyInfo.billing_address.last_name))
				return shopifyInfo.billing_address.first_name + " " + shopifyInfo.billing_address.last_name
		
	}
	// FROM SHIPPING ADDRESS
	if ( existsData (shopifyInfo.shipping_address))
	{
		if ( existsData (shopifyInfo.shipping_address.name))
			return shopifyInfo.shipping_address.name;
		else
			if ( existsData (shopifyInfo.shipping_address.first_name) && existsData (shopifyInfo.shipping_address.last_name))
				return shopifyInfo.shipping_address.first_name + " " + shopifyInfo.shipping_address.last_name
	}
	// NONE
	return undefined;
}