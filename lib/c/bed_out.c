/*
# Descriptions   : 
# Usage          : 
# Parameters	 : none
# Sample Input   : 
# Sample Output  : 
# Depedency      : none
# Temp File      : none
# Comments       : none
# See Also       : none
# Data           : 
# Template       : Last modified date 11/16/10
# Author         : setupX
*/

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <limits.h>

#include "../format_bed.h"


int main(int argc, char *argv[]){
	FILE *fp;
	char line[200];
	char file[MAX_FILE_NAME_SIZE];
	int ln,i;
	char *token;
	BED *beds;

	strcpy(file,argv[1]);
	ln=read_bed_file(file,&beds);
	sort_bed(&beds,ln);
	for (i=0;i<ln;i++)
		write_bed(&beds[i]);
	return 1;
}
