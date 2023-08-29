import { Cluster } from '@/cluster';
import useCreateClusterModal from '@/hooks/modal/useCreateClusterModal';
import { useConnect } from '@/hooks/useConnect';
import useEstimatedOnChainSize from '@/hooks/useEstimatedOnChainSize';
import { trpc } from '@/server';
import { getFriendlyErrorMessage } from '@/utils/error';
import { BI } from '@ckb-lumos/lumos';
import {
  Text,
  Box,
  Group,
  Select,
  Image,
  Button,
  ScrollArea,
  createStyles,
  useMantineTheme,
  Flex,
  AspectRatio,
  Overlay,
  Center,
  Popover,
} from '@mantine/core';
import { Dropzone, DropzoneProps, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconChevronDown } from '@tabler/icons-react';
import { useState, useCallback, forwardRef, useRef, useMemo } from 'react';

const MAX_SIZE_LIMIT = parseInt(
  process.env.NEXT_PUBLIC_MINT_SIZE_LIMIT ?? '300',
  10,
);

export interface MintSporeModalProps {
  defaultClusterId?: string;
  clusters: Cluster[];
  onSubmit: (
    content: Blob | null,
    clusterId: string | undefined,
  ) => Promise<void>;
}

const useStyles = createStyles((theme) => ({
  create: {
    position: 'absolute',
    bottom: '0px',
    width: '100%',
    height: '42px',
    padding: '8px 16px',
    backgroundColor: theme.white,
    cursor: 'pointer',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: theme.colors.border[0],
    borderBottomLeftRadius: '6px',
    borderBottomRightRadius: '6px',
  },
  scroll: {
    paddingBottom: '42px',
  },
  select: {
    'div[aria-expanded=true] .mantine-Select-input': {
      padding: '12px 15px',
      borderColor: theme.colors.brand[1],
      borderBottomRightRadius: '0px',
      borderBottomLeftRadius: '0px',
      borderWidth: '2px',
    },
  },
  input: {
    height: '50px',
    padding: '12px 16px',
    fontSize: '16px',
    color: theme.colors.text[0],
    borderColor: theme.colors.text[0],
    borderWidth: '1px',
    borderRadius: '6px',

    '&:focus': {
      padding: '12px 15px',
      borderColor: theme.colors.brand[1],
      borderWidth: '2px',
    },

    '&::placeholder': {
      color: theme.colors.text[2],
      fontSize: '16px',
    },
  },
  dropdown: {
    top: '118px !important',
    borderTopLeftRadius: '0px',
    borderTopRightRadius: '0px',
    borderColor: theme.colors.brand[1],
    borderWidth: '2px',
    borderBottomLeftRadius: '6px',
    borderBottomRightRadius: '6px',
  },
  dropzone: {
    width: '616px',
    height: '260px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    borderColor: theme.colors.text[0],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '6px',
    backgroundColor: theme.colors.background[1],
  },
  image: {
    width: '616px',
    height: '260px',
  },
  change: {
    height: '48px',
    minWidth: '132px',
    borderColor: theme.colors.text[0],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  submit: {
    backgroundColor: theme.colors.brand[1],
    '&:hover': {
      backgroundColor: '#7F6BD1',
      borderRadius: '4px',
    },
  },
  popover: {
    backgroundColor: theme.colors.brand[1],
    border: 'none',
    boxShadow: '4px 4px 0 #111318',
  },
  arrow: {
    backgroundColor: theme.colors.brand[1],
    border: 'none',
    boxShadow: '4px 2px 0 #111318, 1px 2px 0 #111318',
  },
}));

const DropdownContainer: React.ForwardRefRenderFunction<
  any,
  React.PropsWithChildren<{}>
> = (props, ref) => {
  const { classes } = useStyles();
  const { children, ...restProps } = props;
  const createClusterModal = useCreateClusterModal();

  return (
    <ScrollArea ref={ref} classNames={{ root: classes.scroll }} {...restProps}>
      {children}
      <Box className={classes.create} onClick={createClusterModal.open}>
        <Text color="text.0">+ Create new Cluster</Text>
      </Box>
    </ScrollArea>
  );
};
const DropdownContainerRef = forwardRef(DropdownContainer);

export default function MintSporeModal(props: MintSporeModalProps) {
  const { defaultClusterId, clusters, onSubmit } = props;
  const { classes } = useStyles();
  const theme = useMantineTheme();
  const { address } = useConnect();
  const [hovered, setHovered] = useState(false);
  const dropzoneOpenRef = useRef<() => void>(null);
  const [clusterId, setClusterId] = useState<string | undefined>(
    defaultClusterId,
  );
  const [dataUrl, setDataUrl] = useState<string | ArrayBuffer | null>(null);
  const [content, setContent] = useState<Blob | null>(null);
  const [opened, { close, open }] = useDisclosure(false);
  const onChainSize = useEstimatedOnChainSize(clusterId, content);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { data: capacity = '0' } = trpc.accout.balance.useQuery({ address });
  const balance = useMemo(() => {
    if (!capacity) return 0;
    return Math.floor(BI.from(capacity).toNumber() / 10 ** 8);
  }, [capacity]);

  const handleDrop: DropzoneProps['onDrop'] = useCallback((files) => {
    const [file] = files;
    setContent(file);
    const reader = new window.FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      setDataUrl(reader.result);
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    try {
      setLoading(true);
      await onSubmit(content, clusterId);
      setLoading(false);
    } catch (err) {
      setError(err as Error);
      setLoading(false);
    }
  }, [onSubmit, clusterId, content]);

  return (
    <Box>
      <Flex mb="24px">
        <Text color="text.0" mr="5px">
          Balance:
        </Text>
        <Text color="text.0" weight="700">
          {balance} CKB
        </Text>
        {content && balance - onChainSize > 0 && (
          <Text color="text.1" ml="5px">
            (will be ~{balance - onChainSize} CKB after minting)
          </Text>
        )}
      </Flex>
      <Select
        mb="md"
        maxDropdownHeight={200}
        dropdownPosition="bottom"
        placeholder="Select a Cluster (optional)"
        rightSection={<IconChevronDown color={theme.colors.text[0]} />}
        classNames={{
          root: classes.select,
          input: classes.input,
          dropdown: classes.dropdown,
        }}
        data={clusters.map(({ id, name }) => ({
          value: id,
          label: name,
        }))}
        value={clusterId}
        onChange={(id) => setClusterId(id || undefined)}
        dropdownComponent={DropdownContainerRef}
        disabled={loading}
        searchable
      />

      {dataUrl ? (
        <Box
          className={classes.imageContainer}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <AspectRatio ratio={616 / 260}>
            <Image
              width="616px"
              height="260px"
              className={classes.image}
              src={dataUrl.toString()}
              alt="preview"
              fit="contain"
            />
            {hovered && !loading && (
              <Overlay
                color="#E0E0E0"
                opacity={0.7}
                sx={{ borderRadius: '6px' }}
              >
                <Center
                  className={classes.change}
                  onClick={() => dropzoneOpenRef.current?.()}
                >
                  <Text color="text.0" weight="bold">
                    Change Image
                  </Text>
                </Center>
              </Overlay>
            )}
          </AspectRatio>
        </Box>
      ) : (
        <Dropzone
          openRef={dropzoneOpenRef}
          onDrop={handleDrop}
          classNames={{ root: classes.dropzone }}
          accept={IMAGE_MIME_TYPE}
          onReject={() => {
            notifications.show({
              color: 'red',
              title: 'Error!',
              message:
                'Only image files are supported, and the size cannot exceed 300KB.',
            });
          }}
          maxSize={MAX_SIZE_LIMIT * 1000}
        >
          <Flex direction="column" align="center">
            <Flex align="center" mb="16px">
              <Text size="xl">Drag or</Text>
              <Text
                size="xl"
                color="brand.1"
                sx={{ textDecoration: 'underline' }}
                mx="5px"
                inline
              >
                upload
              </Text>
              <Text size="xl">an image here</Text>
            </Flex>
            <Text size="sm" color="text.1">
              The file cannot exceed {MAX_SIZE_LIMIT} KB
            </Text>
          </Flex>
        </Dropzone>
      )}
      {content && (
        <Flex direction="column" my="md">
          <Flex>
            <Text color="text.0">Estimated On-chain Size</Text>
          </Flex>
          <Flex align="center">
            <Text weight="bold" color="text.0" mr="5px">
              ≈ {onChainSize} CKB
            </Text>
            <Popover
              width={356}
              classNames={{ dropdown: classes.popover, arrow: classes.arrow }}
              arrowOffset={15}
              position="top-start"
              opened={opened}
              withArrow
            >
              <Popover.Target>
                <Image
                  src="/svg/icon-info.svg"
                  alt="info"
                  width="20"
                  height="20"
                  sx={{ cursor: 'pointer' }}
                  onMouseEnter={open}
                  onMouseLeave={close}
                />
              </Popover.Target>
              <Popover.Dropdown sx={{ pointerEvents: 'none' }}>
                <Text color="white" size="sm">
                  By creating a spore, you are reserving this amount of CKB for
                  on-chain storage. You can always destroy spores to redeem your
                  reserved CKB.
                </Text>
              </Popover.Dropdown>
            </Popover>
          </Flex>
        </Flex>
      )}
      {error && (
        <Text size="sm" color="functional.0">
          {getFriendlyErrorMessage(error.message)}
        </Text>
      )}
      <Group position="right" mt="32px">
        <Button
          className={classes.submit}
          disabled={!content}
          onClick={handleSubmit}
          loading={loading}
        >
          Mint
        </Button>
      </Group>
    </Box>
  );
}
